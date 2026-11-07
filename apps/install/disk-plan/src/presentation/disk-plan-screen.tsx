import { Box, Text, useApp } from "ink";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
	AppShell,
	ContentWidth,
	fitFooter,
	keymapStatusSegments,
	resolveIntentColor,
	startCommand,
	textStatusSegment,
	useAsyncTask,
	useFocusPlane,
	useGridNavigation,
	useKeymap,
	usePageHeight,
	usePageScroll,
	useShellLayout,
	useTuiColors,
	useTuiTheme,
	useTuiViewport,
	PAGE_SCROLL_KEYS,
	type ColorIntent,
	type RunningCommand,
} from "@levitate/tui-kit";
import {
	APPLY_SCHEMA_VERSION,
	CONFIRM_TOKEN,
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
	LIST_DISKS,
	listDisks,
	planCommand,
	resolveDiskPath,
	toRun,
	writeLayout,
} from "../app/plan-runner";
import { toLayout } from "../domain/layout";
import {
	canApply,
	diskPath,
	lastFailure,
	METHODS,
	page,
	position,
	shownPages,
	stepState,
	type DiskChoice,
	type PageId,
	type Run,
	type Session,
	type StepState,
} from "../flow";
import {
	CONFIRM_KEYS,
	CONTENT_KEYS,
	DISK_KEYS,
	GLOBAL_KEYS,
	LAYOUT_KEYS,
	NAV_KEYS,
} from "./keymap";
import { PartitionEditorPage } from "./partition-editor";
import { usePartitionEditor } from "./use-partition-editor";
import {
	ApplyProgress,
	CommandPreview,
	DestructiveConfirm,
	FailureDiagnostics,
	ModeSelection,
	PlanPreview,
	PreflightChecks,
	ResultHandoff,
	TargetDisk,
	Welcome,
} from "./pages";
import { useRecpartRun } from "./use-recpart";

/** About this many columns show a disk card's path, size and model. */
const DISK_CARD_COLUMNS = 40;

type DiskPlanScreenProps = {
	/** `--disk`, or "" to choose from recpart's list. */
	disk: string;
	/** The mode the launcher passed (or recpart's default): preselected and marked "default". */
	mode: InstallMode;
};

export function DiskPlanScreen({ disk: requestedDisk, mode: defaultMode }: DiskPlanScreenProps) {
	const { exit } = useApp();
	// The rail gives way on a narrow terminal (the install screen's half), so pages keep
	// room for their tables.
	const { columns: terminalColumns } = useTuiViewport();
	const shell = useShellLayout({ navWidth: terminalColumns < 110 ? 28 : 38 });
	const focus = useFocusPlane({ initial: "navigation" });
	const [pageId, setPageId] = useState<PageId>("welcome");
	const [showFailure, setShowFailure] = useState(false);
	const [token, setToken] = useState("");
	const [apply, setApply] = useState<Run<ApplyResult>>({ kind: "idle" });
	const [notice, setNotice] = useState<string | null>(null);
	// The one destructive apply of this session, held so it cannot start twice.
	const applyRun = useRef<RunningCommand | null>(null);

	const listing = useAsyncTask("list-disks", listDisks);
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
	const columns = Math.max(
		1,
		Math.min(4, Math.floor(shell.content.textColumns / DISK_CARD_COLUMNS)),
	);
	const diskNav = useGridNavigation({ count: choices.length, columns });
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

	// The layout page's four choices: each method, for each mode.
	const layoutChoices = METHODS.flatMap((method) =>
		INSTALL_MODES.map((mode) => ({ method, mode })),
	);
	const layoutNav = useGridNavigation({
		count: layoutChoices.length,
		columns: INSTALL_MODES.length,
		initialIndex: Math.max(0, INSTALL_MODES.indexOf(defaultMode)),
	});
	const { mode, method } = layoutChoices[layoutNav.safeIndex]!;

	const current = page(pageId);
	const view: PageId = showFailure ? "failure-diagnostics" : pageId;
	const contentFocus = focus.isContent && current.interactive && !showFailure;

	const inspect = useRecpartRun<InspectResult>(
		path && method === "edit" && reached("partitions") ? inspectCommand(path) : null,
		INSPECT_SCHEMA_VERSION,
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
	const plan = useRecpartRun<PartitionPlan>(
		path && (method === "edit" ? reached("partitions") && layoutFile : reached("plan-preview"))
			? planCommand(path, mode, layoutFile)
			: null,
		PLAN_SCHEMA_VERSION,
	);
	const dryRun = useRecpartRun<ApplyResult>(
		path && reached("command-preview") && plan.kind === "ok"
			? applyCommand(path, mode, layoutFile, true)
			: null,
		APPLY_SCHEMA_VERSION,
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
		token,
	};
	// The token confirms one disk and one layout.
	useEffect(() => setToken(""), [path, mode, method, layoutFile]);
	const prompting = editor.prompt !== null && pageId === "partitions";
	useEffect(() => {
		if (focus.isContent && !current.interactive) focus.setPlane("navigation");
	}, [pageId]);

	const go = (id: PageId | null) => {
		if (id === null) return;
		setPageId(id);
		setNotice(null);
	};
	const next = () => {
		if (current.gate && !current.gate.holds(session)) {
			setNotice(`to continue, ${current.gate.rule}`);
			return;
		}
		go(current.next(session));
	};
	const back = () => (showFailure ? setShowFailure(false) : go(current.back(session)));
	const startApply = () => {
		if (!canApply(session) || applyRun.current || !path) return;
		const argv = applyCommand(path, mode, layoutFile, false);
		const running = startCommand(argv);
		applyRun.current = running;
		setApply({ kind: "running", argv });
		go("apply-progress");
		void running.result.then((result) =>
			setApply(toRun<ApplyResult>(result, APPLY_SCHEMA_VERSION)),
		);
	};

	useKeymap(
		GLOBAL_KEYS,
		{
			quit: () =>
				apply.kind === "running" ? setNotice("can't quit while recpart apply is running") : exit(),
			focus: () => (current.interactive ? focus.togglePlane() : focus.setPlane("navigation")),
			failure: () =>
				lastFailure(session) ? setShowFailure((shown) => !shown) : setNotice("nothing has failed"),
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
		LAYOUT_KEYS,
		{
			move: (key) =>
				layoutNav.move(
					["up", "k"].includes(key)
						? "up"
						: ["down", "j"].includes(key)
							? "down"
							: ["left", "h"].includes(key)
								? "left"
								: "right",
				),
		},
		{ active: pageId === "mode-selection" && contentFocus },
	);
	useKeymap(
		CONFIRM_KEYS,
		{ apply: startApply, erase: () => setToken((value) => value.slice(0, -1)) },
		{
			active: pageId === "destructive-confirm" && !showFailure,
			onText: (text) => setToken((value) => (value + text).slice(0, CONFIRM_TOKEN.length)),
		},
	);

	const listingState =
		listing.kind === "error"
			? listing
			: listing.kind === "done"
				? ({ kind: "done" } as const)
				: ({ kind: "running" } as const);
	const listRun: Run<unknown> =
		listing.kind === "running" || listing.kind === "idle"
			? { kind: "running", argv: LIST_DISKS }
			: listing.kind === "done"
				? { kind: "ok", argv: LIST_DISKS, value: listing.value }
				: {
						kind: "failed",
						argv: LIST_DISKS,
						exitCode: null,
						output: listing.message,
						error: null,
					};
	const body: Record<PageId, () => ReactNode> = {
		welcome: () => <Welcome session={session} />,
		"target-disk": () => (
			<TargetDisk
				choices={choices}
				selected={diskNav.safeIndex}
				columns={columns}
				width={shell.content.textColumns}
				listing={listingState}
			/>
		),
		"mode-selection": () => (
			<ModeSelection
				choices={layoutChoices}
				selected={layoutNav.safeIndex}
				defaultMode={defaultMode}
				width={shell.content.textColumns}
			/>
		),
		partitions: () => (
			<PartitionEditorPage inspect={inspect} editor={editor} mode={mode} plan={plan} />
		),
		"plan-preview": () => <PlanPreview plan={plan} />,
		"command-preview": () => (
			<CommandPreview log={[listRun, plan, dryRun, apply]} dryRun={dryRun} />
		),
		"preflight-checks": () => <PreflightChecks session={session} />,
		"destructive-confirm": () => <DestructiveConfirm session={session} />,
		"apply-progress": () => <ApplyProgress apply={apply} dryRun={dryRun} />,
		"result-handoff": () => <ResultHandoff apply={apply} />,
		"failure-diagnostics": () => <FailureDiagnostics session={session} />,
	};

	const keys = [
		...(pageId === "destructive-confirm"
			? CONFIRM_KEYS
			: contentFocus && pageId === "partitions"
				? editor.keys
				: contentFocus
					? [
							...CONTENT_KEYS,
							...(pageId === "target-disk" ? DISK_KEYS : []),
							...(pageId === "mode-selection" ? LAYOUT_KEYS : []),
						]
					: NAV_KEYS),
		...(prompting
			? []
			: GLOBAL_KEYS.filter((b) => b.action !== "failure" || lastFailure(session) !== null)),
	];
	// A page taller than its pane scrolls.
	const pageHeight = usePageHeight(view);
	const typing = (pageId === "destructive-confirm" && !showFailure) || prompting;
	const scrollable = !typing && pageHeight.height > shell.content.textRows - 2;
	const railPages = shownPages(session).filter((p) => p.phase);
	const step = railPages.findIndex((p) => p.id === view);
	const layout = fitFooter(shell, [
		textStatusSegment(
			"focus",
			contentFocus ? "content" : "steps",
			contentFocus ? "accent" : "warning",
		),
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...((notice ?? (pageId === "partitions" ? editor.notice : null))
			? [
					textStatusSegment(
						"notice",
						(notice ?? (pageId === "partitions" ? editor.notice : null))!,
						"warning",
					),
				]
			: []),
	]);
	const scroll = usePageScroll(pageHeight, layout.content.textRows, !typing);
	return (
		<ContentWidth.Provider value={layout.content.textColumns}>
			<AppShell
				layout={layout}
				focus={contentFocus ? "content" : "navigation"}
				navTitle="Steps"
				nav={<Rail view={view} session={session} />}
				contentTitle={`${
					step >= 0
						? `Step ${step + 1} of ${railPages.length} · ${page(view).title}`
						: page(view).title
				}${scroll.more}`}
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
		</ContentWidth.Provider>
	);
}

const STATE_MARK: Record<StepState, { mark: string; intent: ColorIntent }> = {
	done: { mark: "✓", intent: "success" },
	current: { mark: "▸", intent: "accent" },
	failed: { mark: "✗", intent: "error" },
	pending: { mark: "○", intent: "dimText" },
};

/** Every step under its phase, marked done, current, failed or still ahead, with the
 * choices made so far beside their steps. */
function Rail({ view, session }: { view: PageId; session: Session }): ReactNode {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const pages = shownPages(session);
	const phases = [...new Set(pages.flatMap((p) => (p.phase ? [p.phase] : [])))];
	const changes = session.layout?.actions.length ?? 0;
	const choice: Partial<Record<PageId, string>> = {
		"target-disk": session.disk ? diskPath(session.disk) : undefined,
		"mode-selection": `${session.mode} · ${session.method}`,
		partitions: session.layout
			? session.layout.new_table
				? "new table"
				: `${changes} change${changes === 1 ? "" : "s"}`
			: undefined,
	};
	const color = (intent: ColorIntent) => resolveIntentColor(theme, intent, colors);
	return (
		<Box flexDirection="column">
			<Text color={color(view === "welcome" ? "accent" : "navItem")} bold={view === "welcome"}>
				{view === "welcome" ? "▸ " : "  "}Overview
			</Text>
			{phases.map((phase) => (
				<Box key={phase} flexDirection="column" marginTop={1}>
					<Text bold color={color("navHeading")}>
						{phase.toUpperCase()}
					</Text>
					{pages
						.filter((p) => p.phase === phase)
						.map((p) => {
							const state = stepState(p.id, view, session);
							const { mark, intent } = STATE_MARK[state];
							return (
								<Text key={p.id}>
									<Text color={color(intent)}>{mark} </Text>
									<Text
										bold={state === "current"}
										color={color(
											state === "current" ? "accent" : state === "pending" ? "dimText" : "navItem",
										)}
									>
										{p.title}
									</Text>
									{choice[p.id] ? (
										<Text color={color("dimText")}>{`  ${choice[p.id]}`}</Text>
									) : null}
								</Text>
							);
						})}
				</Box>
			))}
			{view === "failure-diagnostics" ? (
				<Box marginTop={1}>
					<Text bold color={color("error")}>
						▸ Failure
					</Text>
				</Box>
			) : null}
		</Box>
	);
}
