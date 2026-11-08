import { Box, useApp, useStdout } from "ink";
import { useMemo, useState } from "react";
import {
	AppShell,
	RichTextLine,
	truncateLine,
	useFocusPlane,
	useKeymap,
	useScrollState,
	fitFooter,
	useShellLayout,
	type NavListMode,
	type RichTextRun,
} from "@levitate/tui-kit";
import { BACKWARD_KEYS, CONTENT_KEYS, NAV_KEYS, VIEWER_KEYS } from "../keymap";
import type { Docs } from "../../../docs";
import { layoutPage, type Line } from "../../../layout/page";
import { InstallSidebar } from "../components/sidebar";
import { installStatusSegments } from "../components/status-bar";
import { useInstallNavigation } from "../hooks/use-install-navigation";

type InstallViewerScreenProps = {
	/** The docs of the distro the launcher named. */
	docs: Docs;
	/** Title of the page list. */
	title: string;
	initialIndex: number;
};

/** The line as drawn: runs of the selected action take their `selected` style. */
function drawn(line: Line, selected: number | undefined): RichTextRun[] {
	return line.map(({ anchor, selected: style, ...run }) =>
		anchor !== undefined && anchor === selected ? { ...run, ...style } : run,
	);
}

export function InstallViewerScreen({ docs, title, initialIndex }: InstallViewerScreenProps) {
	const { exit } = useApp();
	const shell = useShellLayout();
	const navigation = useInstallNavigation(docs, initialIndex);
	const { write } = useStdout();
	// When only one pane fits (the install screen's docs pane), start on the page itself.
	const focus = useFocusPlane({ initial: shell.narrow ? "content" : "navigation" });
	const [sidebarMode, setSidebarMode] = useState<NavListMode>("focus-section");
	const [actionIndex, setActionIndex] = useState(0);
	const [runtimeNote, setRuntimeNote] = useState<string | undefined>(undefined);

	const currentItem = docs.pages[navigation.safeIndex]!;
	const columns = shell.content.textColumns;
	const content = docs.content(currentItem.slug);
	const page = useMemo(() => layoutPage(content, columns), [content, columns]);
	const actions = page.anchors;
	// The footer wraps onto as many lines as the pane's width needs; the page gets the rest.
	const layout = fitFooter(
		shell,
		installStatusSegments({
			page: navigation.safeIndex + 1,
			pageCount: docs.pages.length,
			focus: focus.plane,
			action: actions.length > 0 ? `${actionIndex + 1}/${actions.length}` : undefined,
			note: runtimeNote,
		}),
	);
	const rows = layout.content.textRows;
	const scroll = useScrollState(page.lines.length - rows);
	const selectedAnchor = focus.isContent && actions.length > 0 ? actionIndex : undefined;

	const showPage = (move: () => void) => {
		move();
		scroll.toTop();
		setActionIndex(0);
		setRuntimeNote(undefined);
	};
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
		// OSC 52 asks the terminal to set the clipboard; terminals without it ignore the sequence.
		const payload = action.kind === "command" ? action.command : action.href;
		write(`\u001b]52;c;${Buffer.from(payload, "utf8").toString("base64")}\u0007`);
		const what = action.kind === "command" ? "command" : `link (${action.label})`;
		setRuntimeNote(`sent ${what} to the terminal clipboard (OSC 52)`);
	};
	const activateAction = () => {
		const action = actions[actionIndex];
		if (!action || action.kind === "command") {
			copyAction();
			return;
		}
		const target = docs.resolveLink(action.href, currentItem.slug);
		if (!target.ok) {
			setRuntimeNote(`invalid docs link target: '${action.href}' (${target.reason})`);
			return;
		}
		showPage(() => navigation.setPage(target.index));
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
			pageScroll: (key) => scroll.scrollBy(BACKWARD_KEYS.has(key) ? -pageJump : pageJump),
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
			navTitle={title}
			nav={
				<InstallSidebar
					items={docs.pages}
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
		/>
	);
}
