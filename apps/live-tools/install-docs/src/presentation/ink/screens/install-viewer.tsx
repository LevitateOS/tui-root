import { Box, useApp } from "ink";
import { useEffect, useMemo, useState } from "react";
import type { DocsContent } from "@levitate/docs-content";
import {
	AppShell,
	RichTextLine,
	truncateLine,
	useFocusPlane,
	useKeymap,
	useScrollState,
	useShellLayout,
	type NavListMode,
	type RichTextRun,
} from "@levitate/tui-kit";
import { BACKWARD_KEYS, CONTENT_KEYS, NAV_KEYS, VIEWER_KEYS } from "../keymap";
import type { FlatDocsNavItem } from "../../../domain/content/contracts";
import { resolveDocsLinkTarget } from "../../../domain/navigation/link-target";
import { layoutPage, type Line } from "../../../layout/page";
import { InstallSidebar } from "../components/sidebar";
import { InstallStatusBar } from "../components/status-bar";
import { useInstallNavigation } from "../hooks/use-install-navigation";

type InstallViewerScreenProps = {
	navItems: ReadonlyArray<FlatDocsNavItem>;
	getContent: (slug: string, title: string) => DocsContent;
	initialSlug?: string;
};

function copyToClipboardOsc52(text: string): boolean {
	try {
		const payload = Buffer.from(text, "utf8").toString("base64");
		process.stdout.write(`\u001b]52;c;${payload}\u0007`);
		return true;
	} catch {
		return false;
	}
}

/** The line as drawn: runs of the selected action take their `selected` style. */
function drawn(line: Line, selected: number | undefined): RichTextRun[] {
	return line.map(({ anchor, selected: style, ...run }) =>
		anchor !== undefined && anchor === selected ? { ...run, ...style } : run,
	);
}

export function InstallViewerScreen({
	navItems,
	getContent,
	initialSlug,
}: InstallViewerScreenProps) {
	const { exit } = useApp();
	const layout = useShellLayout();
	const navigation = useInstallNavigation(navItems, initialSlug);
	// When only one pane fits (the install screen's docs pane), start on the page itself.
	const focus = useFocusPlane({ initial: layout.narrow ? "content" : "navigation" });
	const [sidebarMode, setSidebarMode] = useState<NavListMode>("focus-section");
	const [actionIndex, setActionIndex] = useState(0);
	const [runtimeNote, setRuntimeNote] = useState<string | undefined>(undefined);

	const currentItem = navItems[navigation.safeIndex]!;
	const rows = layout.content.textRows;
	const columns = layout.content.textColumns;
	const content = getContent(currentItem.slug, currentItem.title);
	const page = useMemo(() => layoutPage(content, columns), [content, columns]);
	const scroll = useScrollState(page.lines.length - rows);
	const actions = page.anchors;
	const selectedAnchor = focus.isContent && actions.length > 0 ? actionIndex : undefined;

	useEffect(() => {
		setActionIndex(0);
		setRuntimeNote(undefined);
	}, [currentItem.slug]);

	const showPage = (move: () => void) => {
		move();
		scroll.toTop();
		setRuntimeNote(undefined);
	};
	/** Scrolls just enough to bring action `index` into view. */
	const reveal = (index: number) => {
		const line = actions[index]?.line ?? 0;
		if (line < scroll.offset) scroll.scrollTo(line);
		else if (line >= scroll.offset + rows) scroll.scrollTo(line - rows + 1);
	};
	const moveAction = (delta: number) => {
		if (actions.length === 0) {
			scroll.scrollBy(delta);
			return;
		}
		const next = (actionIndex + delta + actions.length) % actions.length;
		setActionIndex(next);
		reveal(next);
		setRuntimeNote(undefined);
	};
	const copyAction = () => {
		const action = actions[actionIndex];
		if (!action) {
			setRuntimeNote("no actions on this page");
			return;
		}
		const copied = copyToClipboardOsc52(action.kind === "command" ? action.command : action.href);
		const what = action.kind === "command" ? "command" : `link (${action.label})`;
		setRuntimeNote(copied ? `copied ${what}` : "copy failed (terminal clipboard unsupported)");
	};
	const activateAction = () => {
		const action = actions[actionIndex];
		if (!action || action.kind === "command") {
			copyAction();
			return;
		}
		const target = resolveDocsLinkTarget(action.href, currentItem.slug, navItems);
		if (!target.ok) {
			setRuntimeNote(`invalid docs link target: '${action.href}' (${target.reason})`);
			return;
		}
		showPage(() => navigation.setPage(target.index));
		setActionIndex(0);
		setRuntimeNote(`opened docs page '${target.slug}'`);
	};
	const pageJump = Math.max(1, rows - 1);

	useKeymap(VIEWER_KEYS, {
		quit: () => exit(),
		focus: () => focus.togglePlane(),
		sidebarMode: () =>
			setSidebarMode((previous) =>
				previous === "focus-section" ? "all-sections" : "focus-section",
			),
	});
	useKeymap(
		NAV_KEYS,
		{
			page: (key) => showPage(() => navigation.movePage(BACKWARD_KEYS.has(key) ? -1 : 1)),
			section: (key) => showPage(() => navigation.moveSection(BACKWARD_KEYS.has(key) ? -1 : 1)),
			scroll: (key) => scroll.scrollBy(BACKWARD_KEYS.has(key) ? -1 : 1),
		},
		{ active: focus.isNavigation },
	);
	useKeymap(
		CONTENT_KEYS,
		{
			action: (key) => moveAction(BACKWARD_KEYS.has(key) ? -1 : 1),
			activate: activateAction,
			copy: copyAction,
			pageScroll: (key) => scroll.scrollBy(BACKWARD_KEYS.has(key) ? -pageJump : pageJump),
			top: () => scroll.toTop(),
			bottom: () => scroll.toBottom(),
		},
		{ active: focus.isContent },
	);

	const visible = page.lines.slice(scroll.offset, scroll.offset + rows);
	const shown =
		page.lines.length === 0 ? "0-0" : `${scroll.offset + 1}-${scroll.offset + visible.length}`;
	return (
		<AppShell
			layout={layout}
			focus={focus.plane}
			navTitle="Installation Docs"
			nav={
				<InstallSidebar
					items={navItems}
					selectedIndex={navigation.safeIndex}
					maxWidth={(layout.nav ?? layout.content).textColumns}
					mode={sidebarMode}
				/>
			}
			contentTitle={truncateLine(
				`${currentItem.title}  lines ${shown}/${Math.max(page.lines.length, 1)}`,
				columns,
			)}
			content={
				<Box flexDirection="column" height={rows} overflowY="hidden">
					{visible.map((line, i) => (
						<RichTextLine key={scroll.offset + i} runs={drawn(line, selectedAnchor)} />
					))}
				</Box>
			}
			footer={
				<InstallStatusBar
					page={navigation.safeIndex + 1}
					pageCount={navItems.length}
					focus={focus.plane}
					action={actions.length > 0 ? `${actionIndex + 1}/${actions.length}` : undefined}
					note={runtimeNote ?? navigation.startupNote}
				/>
			}
		/>
	);
}
