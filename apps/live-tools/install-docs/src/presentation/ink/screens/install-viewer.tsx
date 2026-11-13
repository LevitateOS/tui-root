import { Box, useApp, useStdout } from "ink";
import { useMemo, useState } from "react";
import {
	AppShell,
	Heading,
	HEADING_ROWS,
	RichTextLine,
	useFocusPlane,
	useKeymap,
	useScrollState,
	useTuiTheme,
	useTuiViewport,
	fitFooter,
	movesBack,
	useShellLayout,
	type RichTextRun,
} from "@levitate/tui-kit";
import { CONTENT_KEYS, NAV_KEYS, VIEWER_KEYS } from "../keymap";
import type { Docs } from "../../../docs";
import { layoutPage, type Line } from "../../../layout/page";
import { InstallSidebar, type SidebarMode } from "../components/sidebar";
import { installStatusSegments } from "../components/status-bar";
import { useInstallNavigation } from "../hooks/use-install-navigation";

type InstallViewerScreenProps = {
	/** The docs of the distro the launcher named. */
	docs: Docs;
	initialIndex: number;
};

/** The line as drawn: runs of the selected action take their `selected` style. */
function drawn(line: Line, selected: number | undefined): RichTextRun[] {
	return line.map(({ anchor, selected: style, ...run }) =>
		anchor !== undefined && anchor === selected ? { ...run, ...style } : run,
	);
}

export function InstallViewerScreen({ docs, initialIndex }: InstallViewerScreenProps) {
	const { exit } = useApp();
	const back = (key: string) => movesBack([...NAV_KEYS, ...CONTENT_KEYS], key);
	const { columns: terminalColumns } = useTuiViewport();
	const shell = useShellLayout({
		navWidth: terminalColumns < 90 ? 26 : 30,
		navFlush: true,
		steps: true,
		action: true,
	});
	const navigation = useInstallNavigation(docs, initialIndex);
	const { write } = useStdout();
	// When only one pane fits (the install screen's docs pane), start on the page itself.
	const focus = useFocusPlane({ initial: shell.narrow ? "content" : "navigation" });
	const [sidebarMode, setSidebarMode] = useState<SidebarMode>("focus-section");
	const [actionIndex, setActionIndex] = useState(0);
	const [runtimeNote, setRuntimeNote] = useState<string | undefined>(undefined);

	const currentItem = docs.pages[navigation.safeIndex]!;
	const columns = shell.content.textColumns;
	// The first section is the install guide: its pages are numbered steps and tick as you pass.
	const section = docs.pages.filter((page) => page.sectionTitle === currentItem.sectionTitle);
	const position = section.findIndex((page) => page.slug === currentItem.slug);
	const isGuide = currentItem.sectionTitle === docs.pages[0]!.sectionTitle;
	const content = docs.content(currentItem.slug);
	const { appearance } = useTuiTheme();
	const page = useMemo(
		() => layoutPage(content, columns, appearance),
		[content, columns, appearance],
	);
	const actions = page.anchors;
	// The footer wraps onto as many lines as the pane's width needs; the page gets the rest.
	const layout = fitFooter(
		shell,
		installStatusSegments({
			page: navigation.safeIndex + 1,
			pageCount: docs.pages.length,
			focus: focus.plane,
			action: actions.length > 0 ? `${actionIndex + 1}/${actions.length}` : undefined,
		}),
	);
	const rows = layout.content.textRows;
	// A page that fits only without its heading still scrolls once, to show its last lines.
	const furthest =
		page.lines.length > rows - HEADING_ROWS ? Math.max(1, page.lines.length - rows) : 0;
	const scroll = useScrollState(furthest);
	// The heading shows at the top of the page and goes with the first scroll.
	const headingRows = scroll.offset === 0 ? HEADING_ROWS : 0;
	const selectedAnchor = focus.isContent && actions.length > 0 ? actionIndex : undefined;

	const showPage = (move: () => void) => {
		move();
		scroll.toTop();
		setActionIndex(0);
		setRuntimeNote(undefined);
	};
	const reveal = (index: number) => {
		const line = actions[index]?.line ?? 0;
		const room = scroll.offset === 0 ? rows - HEADING_ROWS : rows;
		if (line < scroll.offset) scroll.scrollTo(line);
		else if (line >= scroll.offset + room) scroll.scrollTo(Math.max(1, line - rows + 1));
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
			page: (key) => showPage(() => navigation.movePage(back(key) ? -1 : 1)),
			section: (key) => showPage(() => navigation.moveSection(back(key) ? -1 : 1)),
			scroll: (key) => scroll.scrollBy(back(key) ? -1 : 1),
			pageScroll: (key) => scroll.scrollBy(back(key) ? -pageJump : pageJump),
		},
		{ active: focus.isNavigation },
	);
	useKeymap(
		CONTENT_KEYS,
		{
			action: (key) => moveAction(back(key) ? -1 : 1),
			activate: activateAction,
			copy: copyAction,
			pageScroll: (key) => scroll.scrollBy(back(key) ? -pageJump : pageJump),
			top: () => scroll.toTop(),
			bottom: () => scroll.toBottom(),
		},
		{ active: focus.isContent },
	);

	const firstLine = scroll.offset;
	const visible = page.lines.slice(firstLine, firstLine + rows - headingRows);
	const selected = actions[actionIndex];
	const action =
		runtimeNote !== undefined
			? { note: runtimeNote, intent: "warning" as const }
			: focus.isContent && selected?.kind === "link"
				? { label: `Open ${selected.label}`, key: "Enter" }
				: undefined;
	const navColumns = (layout.nav ?? layout.content).textColumns;
	return (
		<AppShell
			layout={layout}
			focus={focus.plane}
			navTitle="Guide"
			nav={
				<InstallSidebar
					items={docs.pages}
					selectedIndex={navigation.safeIndex}
					width={navColumns}
					rows={(layout.nav ?? layout.content).textRows}
					mode={sidebarMode}
				/>
			}
			contentTitle={currentItem.title}
			progress={{
				total: section.length,
				done: isGuide ? position : 0,
				current: position,
			}}
			action={action}
			content={
				<Box flexDirection="column" height={rows} overflowY="hidden">
					{headingRows > 0 ? (
						<Heading
							title={currentItem.title}
							subtitle={`${currentItem.sectionTitle}, page ${position + 1} of ${section.length}`}
							glyph={isGuide ? position + 1 : undefined}
						/>
					) : null}
					{visible.map((line, i) => (
						<RichTextLine key={firstLine + i} runs={drawn(line, selectedAnchor)} />
					))}
				</Box>
			}
		/>
	);
}
