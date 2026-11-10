import { Box, useApp } from "ink";
import { useState, type ReactNode } from "react";
import {
	movesBack,
	AppShell,
	fitFooter,
	keymapStatusSegments,
	PAGE_SCROLL_KEYS,
	textStatusSegment,
	RailList,
	useKeymap,
	usePageHeight,
	usePageScroll,
	useShellLayout,
	useTuiViewport,
	type PageAction,
	type PageNote,
	type PathState,
	type ProgressSegment,
	type RailGroup,
} from "@levitate/tui-kit";
import {
	ACTION_IDS,
	planAction,
	TAKES_MACHINE_DOWN,
	type ActionId,
	type ActionPlan,
} from "../domain/actions";
import { CONFIRM_KEYS, FOOTER_ACTIONS, MAIN_KEYS, TEXT_KEYS } from "./keymap";
import { ActionPage, HistoryPage, OverviewPage } from "./pages";
import { SLOTS, type Status } from "../generated/recab";
import { useRecab, type Prompt, type Run } from "./use-recab";

type View = "overview" | ActionId | "history";

/** What the rail and the band call a change when there is no plan to name it. */
const PLACE: Record<ActionId, string> = {
	try: "Try the other slot",
	commit: "Commit",
	rollback: "Roll back",
	stage: "Write a system",
	reboot: "Reboot",
};

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
	const shell = useShellLayout({
		navWidth: columns < 110 ? 28 : 34,
		navFlush: true,
		steps: true,
		action: true,
	});
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
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning")] : []),
		recab.running
			? textStatusSegment("busy", `running ${recab.running.argv.join(" ")}`, "warning", false, true)
			: recab.status.kind === "reading"
				? textStatusSegment("busy", "reading status", "dimText", false, true)
				: textStatusSegment(
						"busy",
						s ? `running slot ${s.active_slot}` : "no slots",
						s ? "dimText" : "error",
						false,
						true,
					),
	]);
	const scroll = usePageScroll(pageHeight, layout.content.textRows, prompt === null);

	const runOf = (id: ActionId) => recab.runs.find((run) => run.action === id) ?? null;
	const plan = view === "overview" || view === "history" ? null : planFor(view);
	const run = plan ? runOf(plan.id) : null;
	const page =
		view === "overview" ? (
			<OverviewPage status={recab.status} />
		) : view === "history" ? (
			<HistoryPage runs={recab.runs} />
		) : (
			<ActionPage status={s} plan={plan} prompt={prompt} run={run} now={recab.now} />
		);
	const action = pageAction({ view, status: s, read: recab.status.kind, plan, prompt, run, plans });
	const title =
		view === "overview"
			? "Overview"
			: view === "history"
				? "History"
				: view === "stage"
					? PLACE.stage
					: (planFor(view)?.label ?? PLACE[view]);
	const rail = layout.nav ?? layout.content;
	return (
		<AppShell
			layout={layout}
			focus="navigation"
			navTitle="Updates"
			nav={
				<RailList
					groups={railGroups(plans, recab.runs.length)}
					selected={view}
					width={rail.textColumns}
				/>
			}
			contentTitle={`${title}${scroll.more}`}
			progress={slotSegments(s)}
			action={action}
			content={
				<Box ref={pageHeight.ref} flexDirection="column" flexShrink={0} marginTop={-scroll.offset}>
					{page}
				</Box>
			}
		/>
	);
}

/** The two slots as the step line: the running one on, a trial pending as next. */
function slotSegments(s: Status | null): ProgressSegment[] {
	return SLOTS.map((slot) => ({
		label: `Slot ${slot}`,
		state: !s
			? "off"
			: s.active_slot === slot
				? "on"
				: s.trial_pending && s.next_boot === slot
					? "next"
					: "off",
	}));
}

const VERDICT_STATE: Record<ActionPlan["verdict"]["kind"], PathState> = {
	ready: "ready",
	"no-change": "waiting",
	refused: "failed",
};

/** The overview, each change marked with whether recab would make it now and its hotkey,
 * and the history. */
function railGroups(plans: readonly ActionPlan[], runs: number): RailGroup[] {
	return [
		{ items: [{ id: "overview", label: "Overview", state: "none", hint: "o" }] },
		{
			title: "Changes",
			items: ACTION_IDS.map((id) => {
				const plan = plans.find((p) => p.id === id);
				return {
					id,
					label: plan?.label ?? PLACE[id],
					state: plan ? VERDICT_STATE[plan.verdict.kind] : "none",
					hint: HOTKEY[id],
				};
			}),
		},
		{
			items: [
				{ id: "history", label: runs ? `History · ${runs}` : "History", state: "none", hint: "H" },
			],
		},
	];
}

/** The page's one thing to press, or its one quiet line. */
function pageAction(input: {
	view: View;
	status: Status | null;
	read: "reading" | "ok" | "failed";
	plan: ActionPlan | null;
	prompt: Prompt | null;
	run: Run | null;
	plans: readonly ActionPlan[];
}): PageAction | PageNote | undefined {
	const { view, status, read, plan, prompt, run, plans } = input;
	if (view === "history") return undefined;
	if (view === "overview") {
		if (read === "failed") return { note: "r reads the slots again" };
		return status?.trial_pending && status.next_boot
			? { label: "Reboot into the trial", key: HOTKEY.reboot }
			: undefined;
	}
	if (!plan || prompt) return undefined;
	if (run && !run.result)
		return {
			note: plan.id === "stage" ? "recab stage prints no progress: it is still writing" : "running",
			intent: "warning",
		};
	if (run?.result) {
		if (run.result.exitCode === 0) {
			const next = plan.followUp ? plans.find((p) => p.id === plan.followUp) : null;
			return next && plan.followUp ? { label: next.bar, key: HOTKEY[plan.followUp] } : undefined;
		}
		return plan.verdict.kind === "ready" ? { label: "Try again", key: "Enter" } : undefined;
	}
	return plan.verdict.kind === "ready" ? { label: plan.bar, key: "Enter" } : undefined;
}
