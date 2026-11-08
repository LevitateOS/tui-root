import { Box, Text, useApp } from "ink";
import { useState, type ReactNode } from "react";
import {
	movesBack,
	AppShell,
	ContentWidth,
	fitFooter,
	keymapStatusSegments,
	PAGE_SCROLL_KEYS,
	textStatusSegment,
	textWidth,
	truncateLine,
	useIntentColor,
	useKeymap,
	usePageHeight,
	usePageScroll,
	useShellLayout,
	useTuiViewport,
} from "@levitate/tui-kit";
import {
	ACTION_IDS,
	planAction,
	TAKES_MACHINE_DOWN,
	type ActionId,
	type ActionPlan,
} from "../domain/actions";
import { CONFIRM_KEYS, FOOTER_ACTIONS, MAIN_KEYS, TEXT_KEYS } from "./keymap";
import { ActionPage, HistoryPage, OverviewPage, VerdictMark } from "./pages";
import { useRecab } from "./use-recab";

type View = "overview" | ActionId | "history";

const VIEWS: readonly View[] = ["overview", ...ACTION_IDS, "history"];

const HOTKEY: Record<ActionId, string> = {
	try: "t",
	commit: "c",
	rollback: "x",
	stage: "s",
	reboot: "R",
};

export function RecabScreen(): ReactNode {
	const { exit } = useApp();
	const { columns } = useTuiViewport();
	const shell = useShellLayout({ navWidth: columns < 110 ? 28 : 34 });
	const recab = useRecab();
	const [view, setView] = useState<View>("overview");
	const [notice, setNotice] = useState<string | null>(null);

	const s = recab.current;
	const plans: ActionPlan[] = s ? ACTION_IDS.map((id) => planAction(id, s)) : [];
	const planFor = (id: ActionId) => plans.find((plan) => plan.id === id) ?? null;
	const prompt = recab.prompt;
	const go = (next: View) => {
		if (recab.prompt) recab.cancel();
		setView(next);
		setNotice(null);
	};

	useKeymap(
		MAIN_KEYS,
		{
			move: (key) => {
				const step = movesBack(MAIN_KEYS, key) ? -1 : 1;
				go(VIEWS[(VIEWS.indexOf(view) + step + VIEWS.length) % VIEWS.length]!);
			},
			run: () => {
				if (view === "overview" || view === "history") {
					setNotice("select a change on the left first");
					return;
				}
				const plan = planFor(view);
				setNotice(plan ? recab.begin(plan) : "recab status hasn't been read");
			},
			...Object.fromEntries(ACTION_IDS.map((id) => [id, () => go(id)])),
			overview: () => go("overview"),
			history: () => go("history"),
			refresh: () => {
				setNotice(null);
				void recab.refresh();
			},
			quit: () =>
				recab.running && !TAKES_MACHINE_DOWN[recab.running.action]
					? setNotice(`can't quit while ${recab.running.argv.join(" ")} is running`)
					: exit(),
		},
		{ active: !prompt },
	);
	useKeymap(
		CONFIRM_KEYS,
		{ yes: recab.accept, no: recab.cancel },
		{ active: prompt?.kind === "confirm" },
	);
	useKeymap(
		TEXT_KEYS,
		{
			accept: recab.accept,
			erase: recab.erase,
			complete: recab.complete,
			cancel: recab.cancel,
		},
		{ active: prompt !== null && prompt.kind !== "confirm", onText: recab.type },
	);

	const keys =
		prompt?.kind === "confirm"
			? CONFIRM_KEYS
			: prompt?.kind === "token"
				? TEXT_KEYS.filter((b) => b.action !== "complete")
				: prompt
					? TEXT_KEYS
					: MAIN_KEYS.filter((b) => FOOTER_ACTIONS.includes(b.action));
	const pageHeight = usePageHeight(view);
	const scrollable = !prompt && pageHeight.height > shell.content.textRows - 2;
	const layout = fitFooter(shell, [
		recab.running
			? textStatusSegment("busy", `running ${recab.running.argv.join(" ")}`, "warning")
			: recab.status.kind === "reading"
				? textStatusSegment("busy", "reading status", "accent")
				: textStatusSegment(
						"busy",
						s ? `slot ${s.active_slot}` : "no status",
						s ? "accent" : "error",
					),
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning", true)] : []),
	]);
	const scroll = usePageScroll(pageHeight, layout.content.textRows, prompt === null);

	const runOf = (id: ActionId) => recab.runs.find((run) => run.action === id) ?? null;
	const page =
		view === "overview" ? (
			<OverviewPage status={recab.status} plans={plans} />
		) : view === "history" ? (
			<HistoryPage runs={recab.runs} now={recab.now} />
		) : (
			<ActionPage
				plan={planFor(view)}
				prompt={prompt}
				run={runOf(view)}
				now={recab.now}
				followUp={(() => {
					const id = planFor(view)?.followUp;
					const plan = id ? planFor(id) : null;
					return id && plan ? { key: HOTKEY[id], title: plan.title } : null;
				})()}
			/>
		);
	const title =
		view === "overview"
			? "Overview"
			: view === "history"
				? "History"
				: (planFor(view)?.title ?? view);
	return (
		<ContentWidth.Provider value={layout.content.textColumns}>
			<AppShell
				layout={layout}
				focus="navigation"
				navTitle="recab"
				nav={
					<Rail
						view={view}
						plans={plans}
						runs={recab.runs.length}
						width={(layout.nav ?? layout.content).textColumns}
					/>
				}
				contentTitle={`${title}${scroll.more}`}
				content={
					<Box
						ref={pageHeight.ref}
						flexDirection="column"
						flexShrink={0}
						marginTop={-scroll.offset}
					>
						{page}
					</Box>
				}
			/>
		</ContentWidth.Provider>
	);
}

/** The overview, every change marked with whether recab would make it now, and the
 * history. */
function Rail({
	view,
	plans,
	runs,
	width,
}: {
	view: View;
	plans: readonly ActionPlan[];
	runs: number;
	width: number;
}): ReactNode {
	const color = useIntentColor();
	const item = (id: View, label: string, mark: ReactNode, trailing: string) => {
		const selected = id === view;
		const room = Math.max(1, width - 5 - textWidth(trailing) - 1);
		const text = truncateLine(label, room);
		return (
			<Text key={id}>
				<Text color={color("accent")}>{selected ? "▸ " : "  "}</Text>
				{mark}
				<Text bold={selected} color={color(selected ? "accent" : "navItem")}>
					{` ${text}`}
				</Text>
				<Text color={color("dimText")}>
					{" ".repeat(Math.max(1, width - 4 - textWidth(text) - textWidth(trailing)))}
					{trailing}
				</Text>
			</Text>
		);
	};
	return (
		<Box flexDirection="column">
			{item("overview", "Overview", " ", "o")}
			<Box marginTop={1}>
				<Text bold color={color("navHeading")}>
					CHANGES
				</Text>
			</Box>
			{ACTION_IDS.map((id) => {
				const plan = plans.find((p) => p.id === id) ?? null;
				return item(id, plan?.label ?? id, <VerdictMark plan={plan} />, HOTKEY[id]);
			})}
			<Box marginTop={1}>
				<Text bold color={color("navHeading")}>
					SESSION
				</Text>
			</Box>
			{item("history", runs ? `History · ${runs}` : "History", " ", "H")}
			<Box marginTop={1} flexDirection="column">
				<Text color={color("dimText")}>● recab would do it</Text>
				<Text color={color("dimText")}>○ nothing to change</Text>
				<Text color={color("dimText")}>✗ recab would refuse</Text>
			</Box>
		</Box>
	);
}
