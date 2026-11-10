import { Box, useApp } from "ink";
import { useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import {
	AppShell,
	ContentWidth,
	HEADING_ROWS,
	fitFooter,
	keymapStatusSegments,
	PAGE_SCROLL_KEYS,
	shortDevice,
	StepPath,
	startCommand,
	textStatusSegment,
	useAsyncTask,
	useFocusPlane,
	useGridNavigation,
	useKeymap,
	usePageHeight,
	usePageScroll,
	useShellLayout,
	useTuiViewport,
	type PageAction,
	type PageNote,
	type PathState,
	type PathStep,
	type Progress,
	type RunningCommand,
} from "@levitate/tui-kit";
import {
	APPLY_SCHEMA_VERSION,
	INSPECT_SCHEMA_VERSION,
	INSTALL_MODES,
	PLAN_SCHEMA_VERSION,
	type ApplyResult,
	type InspectResult,
	type InstallMode,
	type PartitionPlan,
} from "../generated/recpart";
import {
	applyCommand,
	inspectCommand,
	listDisks,
	planCommand,
	resolveDiskPath,
	toRun,
	writeDocument,
	writeLayout,
} from "../app/plan-runner";
import { saveDiskStep } from "../app/install-state";
import type { Then } from "@levitate/install-state";
import { diskChanged, start, step as advance, tokenFor } from "../machine";
import { toLayout } from "../domain/layout";
import {
	canApply,
	diskPath,
	lastFailure,
	METHODS,
	page,
	position,
	refusals,
	shownPages,
	stepState,
	type DiskChoice,
	type PageId,
	type Method,
	type Session,
} from "../flow";
import {
	CONFIRM_KEYS,
	CONTENT_KEYS,
	DISK_KEYS,
	GLOBAL_KEYS,
	PICK_FIRST,
	PICK_KEYS,
	NAV_KEYS,
} from "./keymap";
import { PartitionEditorPage } from "./partition-editor";
import { usePartitionEditor } from "./use-partition-editor";
import {
	ApplyProgress,
	CommandPreview,
	DestructiveConfirm,
	FailureDiagnostics,
	DiskUse,
	PlanPreview,
	PreflightChecks,
	ResultHandoff,
	StepNumber,
	SystemChoice,
	TargetDisk,
	Welcome,
} from "./pages";
import { useRecpartRun } from "./use-recpart";
import { MODE_NAME } from "@levitate/docs-content/install";
import { CONFIRM_TOKEN } from "../generated/recpart";

/** The editor's keys the footer shows; the rest are named on the page. */
const EDITOR_FOOTER: ReadonlySet<string> = new Set([
	"select",
	"setup",
	"room",
	"create",
	"remove",
	"resize",
	"format",
	"role",
	"undo",
	"next",
]);

type DiskPlanScreenProps = {
	/** `--disk`, or "" to choose from recpart's list. */
	disk: string;
	/** The mode the launcher passed (or recpart's default): preselected and marked "default". */
	mode: InstallMode;
	/** Where the user goes when the disk is ready. */
	then: Then;
};

export function DiskPlanScreen({
	disk: requestedDisk,
	mode: defaultMode,
	then,
}: DiskPlanScreenProps) {
	const { exit } = useApp();
	// The rail gives way on a narrow terminal (the install screen's half), so pages keep
	// room for their tables.
	const { columns: terminalColumns } = useTuiViewport();
	const shell = useShellLayout({
		navWidth: terminalColumns < 110 ? 28 : 34,
		navFlush: true,
		steps: true,
		action: true,
	});
	const focus = useFocusPlane({ initial: "navigation" });
	const [machine, dispatch] = useReducer(advance, defaultMode, start);
	const {
		page: pageId,
		failureShown: showFailure,
		notice,
		mode,
		method,
		apply,
		saved,
		reads,
	} = machine;
	// The one destructive apply of this session, held so it cannot start twice.
	const applyRun = useRef<RunningCommand | null>(null);

	const listing = useAsyncTask(`list-disks:${reads}`, listDisks);
	const wanted = requestedDisk.trim();
	const choices = useMemo<DiskChoice[]>(() => {
		const listed: DiskChoice[] =
			listing.kind === "done" ? listing.value.map((disk) => ({ kind: "listed", disk })) : [];
		const resolved = wanted && resolveDiskPath(wanted);
		const isListed = listed.some((choice) => diskPath(choice) === resolved);
		return wanted && listing.kind !== "running" && !isListed
			? [{ kind: "unlisted", path: wanted }, ...listed]
			: listed;
	}, [listing, wanted]);
	const diskNav = useGridNavigation({ count: choices.length, columns: 1 });
	useEffect(() => {
		if (listing.kind === "done" && wanted) {
			const resolved = resolveDiskPath(wanted);
			diskNav.setIndex(
				Math.max(
					0,
					choices.findIndex((c) => diskPath(c) === resolved || diskPath(c) === wanted),
				),
			);
		}
	}, [listing.kind]);

	const disk = choices[diskNav.safeIndex] ?? null;
	const path = disk ? diskPath(disk) : null;
	const reached = (id: PageId) => position(pageId) >= position(id);

	const current = page(pageId);
	const view: PageId = showFailure ? "failure-diagnostics" : pageId;
	const contentFocus = focus.isContent && current.interactive && !showFailure;

	const inspect = useRecpartRun<InspectResult>(
		path && reached("disk-use") ? inspectCommand(path) : null,
		INSPECT_SCHEMA_VERSION,
		reads,
	);
	const inspected = inspect.kind === "ok" ? inspect.value : null;
	const editor = usePartitionEditor({
		inspect: inspected,
		mode,
		active: contentFocus && pageId === "partitions",
		next: () => next(),
		back: () => back(),
	});
	const manualLayout = method === "edit" && inspected ? toLayout(inspected, editor.edits) : null;
	const layoutJson = manualLayout ? JSON.stringify(manualLayout) : null;
	const layoutFile = useMemo(() => (manualLayout ? writeLayout(manualLayout) : null), [layoutJson]);
	// The mode's template over the whole disk: what erasing leaves, shown beside the
	// choice and, when erasing, the plan itself.
	const templatePlan = useRecpartRun<PartitionPlan>(
		path && reached("disk-use") ? planCommand(path, mode, null) : null,
		PLAN_SCHEMA_VERSION,
		reads,
	);
	const editedPlan = useRecpartRun<PartitionPlan>(
		path && method === "edit" && reached("partitions") && layoutFile
			? planCommand(path, mode, layoutFile)
			: null,
		PLAN_SCHEMA_VERSION,
		reads,
	);
	const plan = method === "edit" ? editedPlan : templatePlan;
	// The plan as reviewed: apply must find the disk giving exactly this plan.
	const planFile = useMemo(
		() => (plan.kind === "ok" ? writeDocument("plan", plan.value) : null),
		[plan],
	);
	const dryRun = useRecpartRun<ApplyResult>(
		path && reached("command-preview") && plan.kind === "ok"
			? applyCommand(path, mode, layoutFile, planFile, true)
			: null,
		APPLY_SCHEMA_VERSION,
		reads,
	);
	const session: Session = {
		disk,
		mode,
		method,
		inspect,
		layout: manualLayout,
		plan,
		dryRun,
		apply,
		// What was typed counts only for the plan it was typed for.
		token: tokenFor(machine, planFile),
	};
	const prompting = editor.prompt !== null && pageId === "partitions";
	useEffect(() => {
		if (focus.isContent && !current.interactive) focus.setPlane("navigation");
	}, [pageId]);

	const setNotice = (text: string | null) => dispatch({ type: "notice", text });
	const next = () => dispatch({ type: "next", session });
	const back = () => dispatch({ type: "back", session });
	const startApply = () => {
		if (!canApply(session) || applyRun.current || !path) return;
		const argv = applyCommand(path, mode, layoutFile, planFile, false);
		const running = startCommand(argv);
		applyRun.current = running;
		dispatch({ type: "apply-started", argv });
		void running.result.then((result) => {
			const applied = toRun<ApplyResult>(result, APPLY_SCHEMA_VERSION);
			// A refused apply wrote nothing; after reading again, another may start.
			if (diskChanged(applied)) applyRun.current = null;
			dispatch({
				type: "apply-finished",
				run: applied,
				saved: applied.kind === "ok" ? saveDiskStep(path, mode, applied.value) : null,
			});
		});
	};

	useKeymap(
		GLOBAL_KEYS,
		{
			quit: () =>
				apply.kind === "running" ? setNotice("can't quit while recpart apply is running") : exit(),
			focus: () => (current.interactive ? focus.togglePlane() : focus.setPlane("navigation")),
			failure: () => dispatch({ type: "toggle-failure", session }),
			refresh: () => dispatch({ type: "refresh" }),
		},
		// Escape cancels the editor's question, and typed text goes into it.
		{ active: !prompting },
	);
	useKeymap(
		NAV_KEYS,
		{
			page: (key) => (["up", "k", "left", "h"].includes(key) ? back() : next()),
			open: () => current.interactive && focus.setPlane("content"),
		},
		{ active: !contentFocus },
	);
	useKeymap(
		CONTENT_KEYS,
		{ next, back },
		{ active: contentFocus && pageId !== "destructive-confirm" && pageId !== "partitions" },
	);
	useKeymap(
		DISK_KEYS,
		{
			move: (key) =>
				diskNav.move(
					["up", "k"].includes(key)
						? "up"
						: ["down", "j"].includes(key)
							? "down"
							: ["left", "h"].includes(key)
								? "left"
								: "right",
				),
		},
		{ active: contentFocus && pageId === "target-disk" },
	);
	useKeymap(
		PICK_KEYS,
		{
			pick: (key) => {
				const first = PICK_FIRST.has(key);
				if (pageId === "system") dispatch({ type: "mode", mode: INSTALL_MODES[first ? 0 : 1] });
				else dispatch({ type: "method", method: METHODS[first ? 0 : 1]! });
			},
		},
		{ active: contentFocus && (pageId === "system" || pageId === "disk-use") },
	);
	useKeymap(
		CONFIRM_KEYS,
		{ apply: startApply, erase: () => dispatch({ type: "erase", plan: planFile }) },
		{
			active: pageId === "destructive-confirm" && !showFailure,
			onText: (text) => dispatch({ type: "type", text, plan: planFile }),
		},
	);

	const listingState =
		listing.kind === "error"
			? listing
			: listing.kind === "done"
				? ({ kind: "done" } as const)
				: ({ kind: "running" } as const);
	const railPages = shownPages(session).filter((p) => p.phase);
	const stepIndex = railPages.findIndex((p) => p.id === (showFailure ? "apply-progress" : view));
	// The step's number: none on the overview or the failure view.
	const stepNumber =
		view === "welcome" || view === "failure-diagnostics" ? undefined : stepIndex + 1;
	// What the page may use under its heading, for a list that has to fit.
	const pageRows = Math.max(1, shell.content.textRows - HEADING_ROWS);
	const body: Record<PageId, () => ReactNode> = {
		welcome: () => <Welcome session={session} />,
		"target-disk": () => (
			<TargetDisk
				choices={choices}
				selected={diskNav.safeIndex}
				rows={pageRows}
				listing={listingState}
			/>
		),
		system: () => <SystemChoice modes={INSTALL_MODES} mode={mode} defaultMode={defaultMode} />,
		"disk-use": () => (
			<DiskUse
				method={method}
				mode={mode}
				inspect={inspect}
				erasePlan={templatePlan}
				methods={METHODS as readonly [Method, Method]}
			/>
		),
		partitions: () => (
			<PartitionEditorPage inspect={inspect} editor={editor} mode={mode} plan={plan} />
		),
		"plan-preview": () => <PlanPreview plan={plan} />,
		"command-preview": () => <CommandPreview dryRun={dryRun} />,
		"preflight-checks": () => <PreflightChecks session={session} />,
		"destructive-confirm": () => <DestructiveConfirm session={session} />,
		"apply-progress": () => <ApplyProgress apply={apply} dryRun={dryRun} />,
		"result-handoff": () => <ResultHandoff apply={apply} saved={saved} then={then} />,
		"failure-diagnostics": () => <FailureDiagnostics session={session} />,
	};

	// A page taller than its pane scrolls.
	const pageHeight = usePageHeight(view);
	const pageScrolls = pageHeight.height > shell.content.textRows - 2;
	const keys = [
		...(pageId === "destructive-confirm"
			? CONFIRM_KEYS
			: contentFocus && pageId === "partitions"
				? // The selected row's actions are on the footer, as the keys that do something now.
					editor.keys.filter((b) => editor.prompt || EDITOR_FOOTER.has(b.action))
				: contentFocus
					? [
							...CONTENT_KEYS,
							...(pageId === "target-disk" ? DISK_KEYS : []),
							...(pageId === "system" || pageId === "disk-use" ? PICK_KEYS : []),
						]
					: NAV_KEYS),
		...(prompting
			? []
			: GLOBAL_KEYS.filter((b) => b.action !== "failure" || lastFailure(session) !== null)),
	];
	const typing = (pageId === "destructive-confirm" && !showFailure) || prompting;
	const scrollable = !typing && pageScrolls;
	const layout = fitFooter(shell, [
		textStatusSegment(
			"focus",
			contentFocus ? "content" : "steps",
			contentFocus ? "accent" : "warning",
		),
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning")] : []),
		textStatusSegment(
			"where",
			where(view, session, choices.length, path),
			apply.kind === "running" ? "warning" : view === "failure-diagnostics" ? "error" : "dimText",
			false,
			true,
		),
	]);
	const scroll = usePageScroll(pageHeight, layout.content.textRows, !typing);
	return (
		<ContentWidth.Provider value={layout.content.textColumns}>
			<StepNumber.Provider value={stepNumber}>
				<AppShell
					layout={layout}
					focus={contentFocus ? "content" : "navigation"}
					navTitle="Disk"
					nav={
						<StepPath
							steps={pathSteps(view, session)}
							selected={showFailure || view === "failure-diagnostics" ? "apply-progress" : view}
							width={(layout.nav ?? layout.content).textColumns}
							rows={(layout.nav ?? layout.content).textRows}
						/>
					}
					contentTitle={`${
						view === "welcome"
							? "Overview"
							: view === "failure-diagnostics"
								? "Failure"
								: `step ${stepIndex + 1} of ${railPages.length}`
					}${scroll.more}`}
					progress={progress(
						session,
						railPages.map((p) => p.id),
						view,
					)}
					action={action({
						view,
						session,
						contentFocus,
						prompting,
						handoff: then,
					})}
					content={
						<Box
							ref={pageHeight.ref}
							flexDirection="column"
							flexShrink={0}
							marginTop={-scroll.offset}
						>
							{body[view]()}
						</Box>
					}
				/>
			</StepNumber.Provider>
		</ContentWidth.Provider>
	);
}

/** What the footer's far end says: where things stand on this page. */
function where(view: PageId, session: Session, disks: number, path: string | null): string {
	if (view === "target-disk") return `${disks} disk${disks === 1 ? "" : "s"}`;
	if (view === "welcome") return path ?? "no disk yet";
	if (session.apply.kind === "running") return "writing";
	if (view === "failure-diagnostics") return "stopped";
	if (view === "result-handoff" && session.apply.kind === "ok")
		return session.apply.value.handoff.install_target;
	return path ?? "";
}

/** The step line under the band: a segment a step, filled as far as the steps are done in
 * order, the one you are at in the accent. */
function progress(session: Session, ids: readonly PageId[], view: PageId): Progress {
	const open = ids.findIndex((id) => stepState(id, view, session) !== "done");
	const here = ids.indexOf(view === "failure-diagnostics" ? "apply-progress" : view);
	return {
		total: ids.length,
		done: open < 0 ? ids.length : open,
		current: here < 0 ? undefined : here,
	};
}

/** The page's one thing to press, or the one quiet line in its place. */
const ENTER_VERBS: Partial<Record<PageId, readonly [nav: string, content: string]>> = {
	"target-disk": ["Choose a disk", "Use this disk"],
	system: ["Choose how the system updates", "Go on"],
	"disk-use": ["Choose what happens to the disk", "Go on"],
	partitions: ["Edit the partitions", "Go on"],
};

function action({
	view,
	session,
	contentFocus,
	prompting,
	handoff,
}: {
	view: PageId;
	session: Session;
	contentFocus: boolean;
	prompting: boolean;
	handoff: Then;
}): PageAction | PageNote {
	if (prompting) return { note: "Enter accepts, Esc cancels." };
	if (view === "failure-diagnostics") return { note: "F or k goes back to the apply." };
	if (view === "destructive-confirm")
		return canApply(session)
			? { label: "Write to the disk", key: "Enter" }
			: { note: `Type ${CONFIRM_TOKEN} to unlock the write.` };
	const verbs = ENTER_VERBS[view];
	if (verbs) return { label: contentFocus ? verbs[1] : verbs[0], key: "Enter" };
	switch (view) {
		case "welcome":
			return { note: "j chooses a disk." };
		case "apply-progress":
			return session.apply.kind === "running"
				? { note: "recpart is writing; wait for it.", intent: "warning" }
				: { note: "j goes on, k goes back." };
		case "result-handoff":
			return {
				note:
					handoff === "hub"
						? "q goes back to the install steps, which start the next one."
						: "Run the command above to copy the system.",
			};
		default:
			return { note: "j goes on, k goes back." };
	}
}

/** Short words for each step's answer, at the rail's end. */
function pathValue(id: PageId, session: Session): string {
	const changes = session.layout?.actions.length ?? 0;
	switch (id) {
		case "target-disk":
			return session.disk ? shortDevice(diskPath(session.disk)) : "";
		case "system":
			return MODE_NAME[session.mode];
		case "disk-use":
			return session.method === "erase" ? "erase all" : "keep some";
		case "partitions":
			return session.layout?.new_table
				? "new table"
				: changes
					? `${changes} edit${changes === 1 ? "" : "s"}`
					: "";
		case "plan-preview": {
			const n =
				session.plan.kind === "ok"
					? session.plan.value.summary.filter((e) => e.change !== "untouched").length
					: 0;
			return n ? `${n} change${n === 1 ? "" : "s"}` : "";
		}
		case "command-preview":
			return session.dryRun.kind === "ok" ? `${session.dryRun.value.steps.length}` : "";
		case "preflight-checks":
			return session.dryRun.kind === "ok" && refusals(session).length === 0 ? "passed" : "";
		default:
			return "";
	}
}

/** Every step as a row of the path: its mark, and its answer once the step is reached. */
function pathSteps(view: PageId, session: Session): PathStep[] {
	const reachedPos = position(view === "failure-diagnostics" ? "apply-progress" : view);
	const state = (id: PageId): PathState => {
		const mark = stepState(id, view, session);
		if (mark === "done") return "done";
		if (mark === "failed") return "failed";
		if (mark === "current")
			return id === "apply-progress" && session.apply.kind === "running" ? "running" : "ready";
		return "waiting";
	};
	return [page("welcome"), ...shownPages(session).filter((p) => p.phase)].map((p) => ({
		id: p.id,
		label: p.title,
		state: state(p.id),
		value: position(p.id) <= reachedPos ? pathValue(p.id, session) : "",
	}));
}
