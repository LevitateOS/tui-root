import { Box, useApp } from "ink";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
	AppShell,
	keymapStatusSegments,
	scopeStatusSegment,
	SegmentedStatusLine,
	startCommand,
	textStatusSegment,
	UiText,
	useAppName,
	useAsyncTask,
	useFocusPlane,
	useGridNavigation,
	useKeymap,
	useShellLayout,
	type RunningCommand,
} from "@levitate/tui-kit";
import {
	APPLY_SCHEMA_VERSION,
	CONFIRM_TOKEN,
	INSTALL_MODES,
	PLAN_SCHEMA_VERSION,
	type ApplyResult,
	type InstallMode,
	type PartitionPlan,
} from "../generated/recpart";
import {
	applyCommand,
	LIST_DISKS,
	listDisks,
	planCommand,
	resolveDiskPath,
	toRun,
} from "../app/plan-runner";
import {
	canApply,
	diskPath,
	lastFailure,
	page,
	PAGES,
	type DiskChoice,
	type PageId,
	type Run,
	type Session,
} from "../flow";
import { CONFIRM_KEYS, CONTENT_KEYS, DISK_KEYS, GLOBAL_KEYS, MODE_KEYS, NAV_KEYS } from "./keymap";
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

const position = (id: PageId) => PAGES.findIndex((p) => p.id === id);

type DiskPlanScreenProps = {
	/** `--disk`, or "" to choose from recpart's list. */
	disk: string;
	/** The mode the launcher passed (or recpart's default): preselected and marked "default". */
	mode: InstallMode;
};

export function DiskPlanScreen({ disk: requestedDisk, mode: defaultMode }: DiskPlanScreenProps) {
	const { exit } = useApp();
	const appName = useAppName();
	const layout = useShellLayout({ navWidth: 38 });
	const focus = useFocusPlane({ initial: "navigation" });
	const [pageId, setPageId] = useState<PageId>("welcome");
	const [showFailure, setShowFailure] = useState(false);
	const [mode, setMode] = useState<InstallMode>(defaultMode);
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
		Math.min(4, Math.floor(layout.content.textColumns / DISK_CARD_COLUMNS)),
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
	const plan = useRecpartRun<PartitionPlan>(
		path && reached("plan-preview") ? planCommand(path, mode) : null,
		PLAN_SCHEMA_VERSION,
	);
	const dryRun = useRecpartRun<ApplyResult>(
		path && reached("command-preview") && plan.kind === "ok"
			? applyCommand(path, mode, true)
			: null,
		APPLY_SCHEMA_VERSION,
	);
	const session: Session = { disk, mode, plan, dryRun, apply, token };
	// The token confirms one disk and mode.
	useEffect(() => setToken(""), [path, mode]);

	const current = page(pageId);
	const view: PageId = showFailure ? "failure-diagnostics" : pageId;
	const contentFocus = focus.isContent && current.interactive && !showFailure;
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
		const argv = applyCommand(path, mode, false);
		const running = startCommand(argv);
		applyRun.current = running;
		setApply({ kind: "running", argv });
		go("apply-progress");
		void running.result.then((result) =>
			setApply(toRun<ApplyResult>(result, APPLY_SCHEMA_VERSION)),
		);
	};

	useKeymap(GLOBAL_KEYS, {
		quit: () =>
			apply.kind === "running" ? setNotice("can't quit while recpart apply is running") : exit(),
		focus: () => (current.interactive ? focus.togglePlane() : focus.setPlane("navigation")),
		failure: () =>
			lastFailure(session) ? setShowFailure((shown) => !shown) : setNotice("nothing has failed"),
	});
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
		{ active: contentFocus && pageId !== "destructive-confirm" },
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
		MODE_KEYS,
		{
			toggle: () =>
				setMode(INSTALL_MODES[(INSTALL_MODES.indexOf(mode) + 1) % INSTALL_MODES.length]!),
		},
		{ active: pageId === "mode-selection" && !showFailure },
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
				width={layout.content.textColumns}
				listing={listingState}
			/>
		),
		"mode-selection": () => <ModeSelection mode={mode} defaultMode={defaultMode} />,
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
			: contentFocus
				? [...CONTENT_KEYS, ...(pageId === "target-disk" ? DISK_KEYS : [])]
				: NAV_KEYS),
		...(pageId === "mode-selection" ? MODE_KEYS : []),
		...GLOBAL_KEYS.filter((b) => b.action !== "failure" || lastFailure(session) !== null),
	];
	return (
		<AppShell
			layout={layout}
			focus={contentFocus ? "content" : "navigation"}
			navTitle="Pages"
			nav={
				<Box flexDirection="column">
					{PAGES.map((p) => (
						<UiText key={p.id} intent={p.id === view ? "accent" : "navItem"}>
							{p.id === view ? "▸ " : "  "}
							{p.id}
						</UiText>
					))}
					<UiText> </UiText>
					<UiText>Disk: {path ?? "(none)"}</UiText>
					<UiText>Mode: {mode}</UiText>
				</Box>
			}
			contentTitle={view}
			content={body[view]()}
			footer={
				<SegmentedStatusLine
					segments={[
						scopeStatusSegment(appName),
						textStatusSegment(
							"focus",
							contentFocus ? "content" : "nav",
							contentFocus ? "accent" : "warning",
						),
						textStatusSegment("page", `${view} (${position(view) + 1}/${PAGES.length})`, "accent"),
						...keymapStatusSegments(keys),
						...(notice ? [textStatusSegment("notice", notice, "warning")] : []),
					]}
				/>
			}
		/>
	);
}
