import { Box, Text, useApp, useInput } from "ink";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
	SelectableGrid,
	SegmentedStatusLine,
	SurfaceFrame,
	UiText,
	hotkeyStatusSegment,
	resolveGridColumns,
	scopeStatusSegment,
	textStatusSegment,
	useGridNavigation,
	useHotkeys,
	useTuiViewport,
} from "@levitate/tui-kit";
import type { DiskMode } from "../cli/parse-args";
import {
	buildApplyCommand,
	buildPlanCommand,
	listDisks,
	resolveDiskPath,
	runRecpartDryRun,
	runRecpartPlan,
	startRecpartApply,
	type RecpartRun,
	type RecpartRunResult,
} from "../app/plan-runner";
import {
	APPLY_SCHEMA_VERSION,
	CONFIRM_TOKEN,
	ERROR_SCHEMA_VERSION,
	INSTALL_MODES,
	PLAN_SCHEMA_VERSION,
	type ApplyResult,
	type DiskInventory,
	type ErrorPayload,
	type PartitionPlan,
} from "../contract/recpart";
import {
	currentPage,
	nextPage,
	prevPage,
	setMode,
	type DiskPlanFlowState,
	type DiskPlanPageId,
	DISK_PLAN_PAGES,
} from "../domain/flow";
import { canAdvancePage } from "../domain/guards";
import { formatBytes, known, parseRecpartJson, unlistedDisk } from "../domain/recpart";
import { confirmStatusLine, failureDiagnosticLines, progressStepLine } from "./page-text";

type AsyncState<T> =
	| { kind: "idle" }
	| { kind: "running" }
	| { kind: "success"; value: T }
	| {
			kind: "failure";
			raw: { stdout: string; stderr: string; json: string | null; exitCode: number };
	  }
	| { kind: "error"; message: string };

type FailureDiagnostic = {
	source: "plan" | "apply-dry-run" | "preflight" | "apply";
	detail: ErrorPayload | null;
	observed: string;
	remediation: string;
};

type DiskPlanScreenProps = {
	disk: string;
	mode: DiskMode;
};

function limitLines(input: string, maxLines = 16): string {
	const lines = input.split(/\r?\n/);
	if (lines.length <= maxLines) {
		return input.trimEnd();
	}
	return `${lines.slice(0, maxLines).join("\n")}\n... (${lines.length - maxLines} more lines)`;
}

function isPlanReady(plan: AsyncState<PartitionPlan>): boolean {
	return plan.kind === "success";
}

function isDryRunReady(applyDryRun: AsyncState<ApplyResult>): boolean {
	return applyDryRun.kind === "success";
}

/** Preflight is a fresh dry-run: it passes when recpart would not refuse the disk. */
function arePreflightChecksPassing(preflight: AsyncState<ApplyResult>): boolean {
	return preflight.kind === "success" && preflight.value.warnings.length === 0;
}

function isApplyFinished(apply: AsyncState<ApplyResult>): boolean {
	return apply.kind === "success" || apply.kind === "failure" || apply.kind === "error";
}

function displayVendor(vendor: string): string | null {
	const normalized = known(vendor);
	const generic = new Set(["ATA", "NVME", "SCSI"]);
	if (normalized === null || generic.has(normalized.toUpperCase())) {
		return null;
	}
	return normalized;
}

/**
 * Turn a finished recpart run into the async state: the document of the
 * expected schema on success, the raw output on failure.
 */
function runState<T extends { schema_version: number }>(
	result: RecpartRunResult,
	schemaVersion: number,
): AsyncState<T> {
	if (result.exitCode !== 0) {
		return {
			kind: "failure",
			raw: {
				stdout: result.stdout,
				stderr: result.stderr,
				json: result.json,
				exitCode: result.exitCode,
			},
		};
	}
	const value = parseRecpartJson<T>(result.json, schemaVersion);
	if (!value) {
		return {
			kind: "error",
			message: `${result.command.join(" ")} did not print schema ${schemaVersion} JSON`,
		};
	}
	return { kind: "success", value };
}

/** What the user runs after the disk is ready: this installer's guidance. */
function nextInstallSteps(target: string): string[] {
	return [
		`recstrap ${target}`,
		`recfstab ${target} >> ${target}/etc/fstab`,
		`recchroot ${target}   (then set a root password and install the bootloader)`,
	];
}

function hasInteractiveContent(page: DiskPlanPageId): boolean {
	return page === "target-disk" || page === "mode-selection" || page === "destructive-confirm";
}

export function DiskPlanScreen({ disk, mode }: DiskPlanScreenProps) {
	const { exit } = useApp();
	const [flow, setFlow] = useState<DiskPlanFlowState>({
		pageIndex: 0,
		mode,
		disk,
	});
	const [planState, setPlanState] = useState<AsyncState<PartitionPlan>>({ kind: "idle" });
	const [applyDryRunState, setApplyDryRunState] = useState<AsyncState<ApplyResult>>({
		kind: "idle",
	});
	const [preflightState, setPreflightState] = useState<AsyncState<ApplyResult>>({
		kind: "idle",
	});
	const [applyState, setApplyState] = useState<AsyncState<ApplyResult>>({ kind: "idle" });
	const [confirmToken, setConfirmToken] = useState("");
	const [failure, setFailure] = useState<FailureDiagnostic | null>(null);
	const [diskListError, setDiskListError] = useState<string | null>(null);
	const [diskCandidates, setDiskCandidates] = useState<DiskInventory[]>([]);
	const [activePane, setActivePane] = useState<"nav" | "content">("nav");
	const [failureReturnIndex, setFailureReturnIndex] = useState<number | null>(null);
	// The one destructive apply of this session. Held so it can never be started
	// twice (navigation does not start it; only an explicit confirm does).
	const applyRunRef = useRef<RecpartRun | null>(null);
	const initialDiskRef = useRef(disk);
	const viewport = useTuiViewport();

	const page = currentPage(flow);
	const diskColumnsSpec = useMemo(
		() => ({
			base: 1,
			breakpoints: [
				{ minWidth: 110, columns: 2 },
				{ minWidth: 180, columns: 4 },
			],
		}),
		[],
	);
	const diskGridColumns = resolveGridColumns(diskColumnsSpec, viewport.columns, 1);
	const diskNav = useGridNavigation({
		count: diskCandidates.length,
		columns: diskGridColumns,
		initialIndex: 0,
		disabled: page !== "target-disk",
	});

	const selectDiskAtIndex = (index: number) => {
		if (diskCandidates.length === 0) {
			return;
		}
		const bounded = Math.max(0, Math.min(index, diskCandidates.length - 1));
		const nextDisk = diskCandidates[bounded]?.path ?? "";
		diskNav.setIndex(bounded);
		if (nextDisk.length > 0) {
			setFlow((state) => ({ ...state, disk: nextDisk }));
		}
	};

	const setFailureFromRun = (
		source: FailureDiagnostic["source"],
		run: { stderr: string; stdout: string; json: string | null },
	) => {
		const detail = run.json ? parseRecpartJson<ErrorPayload>(run.json, ERROR_SCHEMA_VERSION) : null;
		setFailure({
			source,
			detail,
			observed: (run.stderr || run.stdout || "(no output)").trim(),
			remediation:
				detail?.remediation ?? "Inspect command stderr and fix prerequisites before retry.",
		});
	};

	// List disks once on mount; the grid selection is the source of truth after
	// that (synced into flow.disk below), so a slow listing cannot snap it back.
	const setDiskIndex = diskNav.setIndex;
	const disksListedRef = useRef(false);
	useEffect(() => {
		if (disksListedRef.current) {
			return;
		}
		disksListedRef.current = true;
		let cancelled = false;
		const explicit = initialDiskRef.current.trim();
		void listDisks()
			.catch((error: unknown) => {
				setDiskListError(error instanceof Error ? error.message : String(error));
				return [] as DiskInventory[];
			})
			.then((listed) => {
				if (cancelled) {
					return;
				}
				let devices = listed;
				if (explicit.length > 0) {
					const wanted = resolveDiskPath(explicit);
					const found = devices.findIndex((item) => item.path === wanted);
					if (found < 0) {
						// Keep an explicit --disk even when recpart does not list it, so
						// the selection never silently moves to another disk; recpart then
						// rejects it with a clear error.
						devices = [unlistedDisk(explicit), ...devices];
					}
					const index = Math.max(
						0,
						devices.findIndex((item) => item.path === wanted || item.path === explicit),
					);
					setDiskCandidates(devices);
					setDiskIndex(index);
					setFlow((state) => ({ ...state, disk: devices[index]?.path ?? explicit }));
					return;
				}
				setDiskCandidates(devices);
				if (devices.length === 0) {
					return;
				}
				setDiskIndex(0);
				const first = devices[0]?.path ?? "";
				if (first.length > 0) {
					setFlow((state) => ({ ...state, disk: first }));
				}
			});
		return () => {
			cancelled = true;
		};
	}, [setDiskIndex]);

	// The confirmation token is bound to one disk + mode.
	useEffect(() => {
		setConfirmToken("");
	}, [flow.disk, flow.mode]);

	useEffect(() => {
		if (page !== "target-disk") {
			return;
		}
		const selectedPath = diskCandidates[diskNav.safeIndex]?.path ?? "";
		if (selectedPath.length === 0 || selectedPath === flow.disk) {
			return;
		}
		setFlow((state) => ({ ...state, disk: selectedPath }));
	}, [diskCandidates, diskNav.safeIndex, flow.disk, page]);

	useInput((input, key) => {
		if (page !== "destructive-confirm") {
			return;
		}
		if (key.backspace || key.delete) {
			setConfirmToken((value) => value.slice(0, -1));
			return;
		}
		if (key.return) {
			startApply();
			return;
		}
		if (key.ctrl || key.meta || input.length !== 1) {
			return;
		}
		if (!/[a-zA-Z]/.test(input)) {
			return;
		}
		setConfirmToken((value) => (value + input.toUpperCase()).slice(0, CONFIRM_TOKEN.length));
	});

	useEffect(() => {
		if (page !== "plan-preview") {
			return;
		}
		let cancelled = false;
		setPlanState({ kind: "running" });
		void runRecpartPlan(flow.disk, flow.mode)
			.then((result) => {
				if (cancelled) {
					return;
				}
				const state = runState<PartitionPlan>(result, PLAN_SCHEMA_VERSION);
				setPlanState(state);
				if (state.kind === "failure") {
					setFailureFromRun("plan", result);
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}
				const message = error instanceof Error ? error.message : String(error);
				setPlanState({ kind: "error", message });
			});
		return () => {
			cancelled = true;
		};
	}, [flow.disk, flow.mode, page]);

	useEffect(() => {
		if (page !== "command-preview") {
			return;
		}
		let cancelled = false;
		setApplyDryRunState({ kind: "running" });
		void runRecpartDryRun(flow.disk, flow.mode)
			.then((result) => {
				if (cancelled) {
					return;
				}
				const state = runState<ApplyResult>(result, APPLY_SCHEMA_VERSION);
				setApplyDryRunState(state);
				if (state.kind === "failure") {
					setFailureFromRun("apply-dry-run", result);
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}
				const message = error instanceof Error ? error.message : String(error);
				setApplyDryRunState({ kind: "error", message });
			});
		return () => {
			cancelled = true;
		};
	}, [flow.disk, flow.mode, page]);

	useEffect(() => {
		if (page !== "preflight-checks") {
			return;
		}
		let cancelled = false;
		setPreflightState({ kind: "running" });
		void runRecpartDryRun(flow.disk, flow.mode)
			.then((result) => {
				if (cancelled) {
					return;
				}
				const state = runState<ApplyResult>(result, APPLY_SCHEMA_VERSION);
				setPreflightState(state);
				if (state.kind === "failure") {
					setFailureFromRun("preflight", result);
				} else if (state.kind === "success" && state.value.warnings.length > 0) {
					setFailure({
						source: "preflight",
						detail: null,
						observed: state.value.warnings.join("\n"),
						remediation: "Resolve what recpart reports, then re-enter this page.",
					});
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}
				const message = error instanceof Error ? error.message : String(error);
				setPreflightState({ kind: "error", message });
			});
		return () => {
			cancelled = true;
		};
	}, [flow.disk, flow.mode, page]);

	const applyStarted = applyState.kind !== "idle";
	const confirmIndex = DISK_PLAN_PAGES.indexOf("destructive-confirm");
	const applyIndex = DISK_PLAN_PAGES.indexOf("apply-progress");
	const failureIndex = DISK_PLAN_PAGES.indexOf("failure-diagnostics");

	function startApply() {
		if (page !== "destructive-confirm" || confirmToken !== CONFIRM_TOKEN) {
			return;
		}
		if (applyRunRef.current !== null || applyStarted) {
			return;
		}
		if (
			flow.disk.trim().length === 0 ||
			!isPlanReady(planState) ||
			!isDryRunReady(applyDryRunState) ||
			!arePreflightChecksPassing(preflightState)
		) {
			return;
		}

		const run = startRecpartApply(flow.disk, flow.mode);
		applyRunRef.current = run;
		setConfirmToken("");
		setApplyState({ kind: "running" });
		setFlow((state) => ({ ...state, pageIndex: applyIndex }));

		void run.result
			.then((result) => {
				const state = runState<ApplyResult>(result, APPLY_SCHEMA_VERSION);
				setApplyState(state);
				if (state.kind === "failure") {
					setFailureFromRun("apply", result);
				}
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				setApplyState({ kind: "error", message });
			})
			.finally(() => {
				applyRunRef.current = null;
			});
	}

	const quit = () => {
		// Never abandon a running partition/format/mount sequence half-way.
		if (applyRunRef.current !== null) {
			return;
		}
		exit();
	};
	const isDiskPage = page === "target-disk";
	const isModePage = page === "mode-selection";
	const isNavFocus = activePane === "nav";
	const isContentFocus = activePane === "content";
	const pageAllowsContentPane = hasInteractiveContent(page);
	const toggleMode = () => {
		setFlow((state) =>
			setMode(state, INSTALL_MODES[(INSTALL_MODES.indexOf(state.mode) + 1) % INSTALL_MODES.length]),
		);
	};
	// Every forward move goes through onNext (guarded by canAdvancePage), and
	// every backward move through onPrev; there are no unguarded page jumps.
	const onNext = () => {
		if (
			!canAdvancePage(page, {
				hasDisk: flow.disk.trim().length > 0,
				planReady: isPlanReady(planState),
				commandPreviewReady: isDryRunReady(applyDryRunState),
				preflightPassing: arePreflightChecksPassing(preflightState),
				confirmUnlocked: confirmToken === CONFIRM_TOKEN,
				applyFinished: isApplyFinished(applyState),
			})
		) {
			return;
		}
		if (page === "destructive-confirm") {
			// The destructive apply starts only from Enter on this page (startApply).
			return;
		}
		if (page === "apply-progress") {
			if (applyState.kind === "success") {
				setFlow((state) => ({ ...state, pageIndex: DISK_PLAN_PAGES.indexOf("result-handoff") }));
			} else {
				setFlow((state) => ({
					...state,
					pageIndex: DISK_PLAN_PAGES.indexOf("failure-diagnostics"),
				}));
			}
			return;
		}
		setFlow((state) => nextPage(state));
	};

	const onPrev = () => {
		if (page === "failure-diagnostics" && failureReturnIndex !== null) {
			const target = failureReturnIndex;
			setFailureReturnIndex(null);
			setFlow((state) => ({ ...state, pageIndex: target }));
			return;
		}
		// After an apply attempt the disk no longer matches the reviewed plan, and
		// the apply cannot be re-run from this session.
		if (applyStarted && flow.pageIndex - 1 <= confirmIndex) {
			return;
		}
		setFlow((state) => prevPage(state));
	};

	useEffect(() => {
		if (activePane === "content" && !pageAllowsContentPane) {
			setActivePane("nav");
		}
	}, [activePane, pageAllowsContentPane]);

	useHotkeys(["q", "escape", "C-c"], quit);
	useHotkeys(["tab", "S-tab"], () => {
		if (!pageAllowsContentPane) {
			setActivePane("nav");
			return;
		}
		setActivePane((pane) => (pane === "nav" ? "content" : "nav"));
	});
	useHotkeys(["n"], () => {
		if (!isContentFocus) {
			return;
		}
		onNext();
	});
	useHotkeys(["p"], () => {
		if (!isContentFocus) {
			return;
		}
		onPrev();
	});
	useHotkeys(["right", "l"], () => {
		if (isNavFocus) {
			onNext();
			return;
		}
		if (!isContentFocus) {
			return;
		}
		if (isDiskPage) {
			diskNav.moveRight();
			return;
		}
		if (isModePage) {
			toggleMode();
			return;
		}
	});
	useHotkeys(["left", "h"], () => {
		if (isNavFocus) {
			onPrev();
			return;
		}
		if (!isContentFocus) {
			return;
		}
		if (isDiskPage) {
			diskNav.moveLeft();
			return;
		}
		if (isModePage) {
			toggleMode();
			return;
		}
	});
	useHotkeys(["down", "j"], () => {
		if (isNavFocus) {
			onNext();
			return;
		}
		if (!isContentFocus) {
			return;
		}
		if (isDiskPage) {
			diskNav.moveDown();
			return;
		}
		if (isModePage) {
			toggleMode();
			return;
		}
	});
	useHotkeys(["up", "k"], () => {
		if (isNavFocus) {
			onPrev();
			return;
		}
		if (!isContentFocus) {
			return;
		}
		if (isDiskPage) {
			diskNav.moveUp();
			return;
		}
		if (isModePage) {
			toggleMode();
			return;
		}
	});
	useHotkeys(["enter"], () => {
		if (isNavFocus) {
			if (pageAllowsContentPane) {
				setActivePane("content");
			}
			return;
		}
		if (!isContentFocus) {
			return;
		}
		if (isDiskPage) {
			selectDiskAtIndex(diskNav.safeIndex);
		}
		onNext();
	});
	useHotkeys(["m"], () => {
		if (!isModePage) {
			return;
		}
		toggleMode();
	});
	useHotkeys(["F"], () => {
		if (!failure) {
			return;
		}
		if (page === "failure-diagnostics") {
			return;
		}
		// Read-only view; onPrev returns to the page it was opened from.
		setFailureReturnIndex(flow.pageIndex);
		setFlow((state) => ({ ...state, pageIndex: failureIndex }));
	});

	const footer = useMemo(() => {
		const nextKeys = isNavFocus ? "j/k/h/l" : "enter/n";
		const backKeys = isNavFocus ? "tab" : "p";
		const segments = [
			scopeStatusSegment("disk-plan"),
			textStatusSegment("focus", activePane, isNavFocus ? "warning" : "accent"),
			textStatusSegment(
				"page",
				`${page} (${flow.pageIndex + 1}/${DISK_PLAN_PAGES.length})`,
				"accent",
			),
			hotkeyStatusSegment("next", nextKeys, "next"),
			hotkeyStatusSegment("back", backKeys, "back"),
			hotkeyStatusSegment(
				"focus",
				pageAllowsContentPane ? "tab" : "-",
				pageAllowsContentPane ? "toggle pane" : "nav-only page",
			),
			hotkeyStatusSegment("quit", "q", "quit"),
		];
		if (isModePage) {
			segments.push(hotkeyStatusSegment("mode", "m/h/l", "toggle"));
		}
		if (isDiskPage) {
			segments.push(hotkeyStatusSegment("pick", "enter/h/j/k/l", "select disk"));
		}
		if (page === "destructive-confirm") {
			segments.push(hotkeyStatusSegment("apply", "enter", `apply after ${CONFIRM_TOKEN}`));
		}
		if (isNavFocus) {
			segments.push(hotkeyStatusSegment("nav", "j/k/h/l", "browse pages"));
			if (pageAllowsContentPane) {
				segments.push(hotkeyStatusSegment("open", "enter", "activate content"));
			}
		}
		if (failure) {
			segments.push(hotkeyStatusSegment("fail", "Shift+f", "failure"));
		}
		return <SegmentedStatusLine segments={segments} />;
	}, [
		activePane,
		failure,
		flow.pageIndex,
		isDiskPage,
		isModePage,
		isNavFocus,
		page,
		pageAllowsContentPane,
	]);

	const sidebar = (
		<Box flexDirection="column">
			{DISK_PLAN_PAGES.map((item, index) => (
				<UiText key={item}>
					{index === flow.pageIndex ? "▸ " : "  "}
					{item}
				</UiText>
			))}
			<UiText> </UiText>
			<UiText>Disk: {flow.disk || "(unset)"}</UiText>
			<UiText>Mode: {flow.mode}</UiText>
		</Box>
	);

	let body: ReactNode = <UiText>Unknown page state.</UiText>;

	if (page === "welcome") {
		body = (
			<Box flexDirection="column">
				<Text bold>Install Disk Plan</Text>
				<UiText> </UiText>
				<UiText>Deterministic install flow for partition planning and apply handoff.</UiText>
				<UiText>UI owns flow/evidence. recpart owns backend execution/contracts.</UiText>
				<UiText> </UiText>
				<Text bold>Flow (10 pages)</Text>
				<UiText>1. welcome</UiText>
				<UiText>2. target-disk</UiText>
				<UiText>3. mode-selection</UiText>
				<UiText>4. plan-preview</UiText>
				<UiText>5. command-preview</UiText>
				<UiText>6. preflight-checks</UiText>
				<UiText>7. destructive-confirm</UiText>
				<UiText>8. apply-progress</UiText>
				<UiText>9. result-handoff</UiText>
				<UiText>10. failure-diagnostics</UiText>
				<UiText> </UiText>
				<Text bold>Safety Controls</Text>
				<UiText>- No apply path before confirmation token gate.</UiText>
				<UiText>- Schema/contract mismatches fail explicitly.</UiText>
				<UiText>- Preflight must pass before destructive apply.</UiText>
				<UiText>- Failure evidence remains inspectable in diagnostics.</UiText>
				<UiText> </UiText>
				<Text bold>Session</Text>
				<UiText>Target disk: {flow.disk || "(unset)"}</UiText>
				<UiText>Mode: {flow.mode}</UiText>
				<UiText> </UiText>
				<UiText>Start with target-disk and verify model/serial before continuing.</UiText>
			</Box>
		);
	}

	if (page === "target-disk") {
		body = (
			<Box flexDirection="column">
				<Text bold>Target Disk</Text>
				<UiText>Selected path: {flow.disk || "(unset)"}</UiText>
				<UiText>Discovered disks (card grid: {diskGridColumns} columns):</UiText>
				{diskCandidates.length === 0 ? (
					<UiText>
						{diskListError ? `- disk listing failed: ${diskListError}` : "- (none discovered)"}
					</UiText>
				) : (
					<SelectableGrid
						items={diskCandidates}
						selectedIndex={diskNav.safeIndex}
						columns={diskColumnsSpec}
						gapX={1}
						gapY={0}
						renderItem={(item, context) => {
							const vendor = displayVendor(item.vendor);
							return (
								<Box
									width="100%"
									borderStyle="single"
									borderColor={context.selected ? "cyan" : "gray"}
									flexDirection="column"
									paddingX={1}
								>
									<Text bold color={context.selected ? "cyan" : undefined}>
										{context.selected ? "▸ " : "  "}
										{item.path}
									</Text>
									<UiText>
										size:{" "}
										{item.size_bytes > 0 ? formatBytes(item.size_bytes) : "(not listed by recpart)"}
									</UiText>
									{vendor ? <UiText>vendor: {vendor}</UiText> : null}
									<UiText>model: {known(item.model) ?? "(unknown)"}</UiText>
									<UiText>transport: {known(item.transport) ?? "(unknown)"}</UiText>
									<UiText>serial: {known(item.serial) ?? "(unknown)"}</UiText>
									<UiText>
										media: {item.rotational ? "hdd" : "ssd"}
										{item.removable ? " | removable" : " | fixed"}
										{item.read_only ? " | read-only" : ""}
									</UiText>
								</Box>
							);
						}}
					/>
				)}
				<UiText> </UiText>
				<UiText>
					{flow.disk.trim().length > 0
						? "Ready to continue. Use h/j/k/l (or arrows) to move between cards."
						: "Missing --disk value."}
				</UiText>
			</Box>
		);
	}

	if (page === "mode-selection") {
		const abSelected = flow.mode === "ab";
		const mutableSelected = flow.mode === "mutable";
		body = (
			<Box flexDirection="column">
				<Text bold>Mode Selection</Text>
				<UiText>Select the installation layout policy before planning.</UiText>
				<UiText>`ab` is the default and recommended mode for LevitateOS.</UiText>
				<UiText>
					LevitateOS is recipe-driven and package/runtime changes are expected to be LLM-assisted.
				</UiText>
				<UiText>
					A/B layout provides safer rollback/recovery boundaries when those automated changes drift.
				</UiText>
				<UiText> </UiText>
				<Box flexDirection="row" gap={1}>
					<Box
						flexDirection="column"
						borderStyle="single"
						borderColor={abSelected ? "cyan" : "gray"}
						paddingX={1}
						width="50%"
					>
						<Text bold color={abSelected ? "cyan" : undefined}>
							{abSelected ? "▸ " : "  "}
							ab (default, recommended)
						</Text>
						<UiText>- Dual-slot style partition layout.</UiText>
						<UiText>- Better rollback/upgrade posture.</UiText>
						<UiText>- Safer for recipe + automated maintenance workflows.</UiText>
					</Box>
					<Box
						flexDirection="column"
						borderStyle="single"
						borderColor={mutableSelected ? "cyan" : "gray"}
						paddingX={1}
						width="50%"
					>
						<Text bold color={mutableSelected ? "cyan" : undefined}>
							{mutableSelected ? "▸ " : "  "}
							mutable (optional, advanced)
						</Text>
						<UiText>- Conventional mutable root filesystem.</UiText>
						<UiText>- Simpler ad-hoc package changes.</UiText>
						<UiText>- Less rollback-oriented and easier to break over time.</UiText>
					</Box>
				</Box>
				<UiText> </UiText>
				<UiText intent="warning">
					Choose mutable only if you have a specific non-A/B use case and accept higher recovery
					risk.
				</UiText>
				<UiText>
					Current mode: <Text color="cyan">{flow.mode}</Text>
				</UiText>
				<UiText>Use m/h/l (or arrows) to toggle mode, then continue.</UiText>
			</Box>
		);
	}

	if (page === "plan-preview") {
		if (planState.kind === "running" || planState.kind === "idle") {
			body = <UiText>Running recpart plan --json ...</UiText>;
		} else if (planState.kind === "success") {
			const plan = planState.value;
			body = (
				<Box flexDirection="column">
					<Text bold>Plan Summary</Text>
					<UiText>Disk: {plan.disk.path}</UiText>
					<UiText>Size: {formatBytes(plan.disk.size_bytes)}</UiText>
					<UiText>Mode: {plan.mode}</UiText>
					<UiText>Partitions: {plan.partitions.length}</UiText>
					<UiText> </UiText>
					{plan.partitions.map((partition) => (
						<UiText key={`${partition.index}-${partition.name}`}>
							#{partition.index} {partition.name} {partition.filesystem} {partition.mountpoint}{" "}
							{partition.size_mb === null ? "(rest)" : `(${partition.size_mb}MB)`}
						</UiText>
					))}
				</Box>
			);
		} else if (planState.kind === "failure") {
			body = (
				<Box flexDirection="column">
					<Text bold color="red">
						Plan Failed
					</Text>
					<UiText>Exit: {planState.raw.exitCode}</UiText>
					<UiText>{limitLines(planState.raw.stderr || planState.raw.stdout)}</UiText>
				</Box>
			);
		} else {
			body = (
				<Box flexDirection="column">
					<Text bold color="red">
						Plan Error
					</Text>
					<UiText>{planState.message}</UiText>
				</Box>
			);
		}
	}

	if (page === "command-preview") {
		if (applyDryRunState.kind === "running" || applyDryRunState.kind === "idle") {
			body = <UiText>Loading dry-run command sequence ...</UiText>;
		} else if (applyDryRunState.kind === "success") {
			const applySummary = applyDryRunState.value;
			body = (
				<Box flexDirection="column">
					<Text bold>Exact Command Sequence (No Hidden Commands)</Text>
					<UiText>{buildPlanCommand(flow.disk, flow.mode).join(" ")}</UiText>
					<UiText>{buildApplyCommand(flow.disk, flow.mode, { dryRun: true }).join(" ")}</UiText>
					<UiText> </UiText>
					{applySummary.steps.map((step, index) => (
						<UiText key={`${step.phase}-${index}`}>
							[{step.phase}] {step.command}
						</UiText>
					))}
					{applySummary.warnings.length > 0 ? (
						<>
							<UiText> </UiText>
							<Text bold color="yellow">
								Apply would refuse this disk
							</Text>
							{applySummary.warnings.map((warning, index) => (
								<UiText key={`warning-${index}`}>{warning}</UiText>
							))}
						</>
					) : null}
				</Box>
			);
		} else if (applyDryRunState.kind === "failure") {
			body = (
				<Box flexDirection="column">
					<Text bold color="red">
						Dry-run Failed
					</Text>
					<UiText>Exit: {applyDryRunState.raw.exitCode}</UiText>
					<UiText>{limitLines(applyDryRunState.raw.stderr || applyDryRunState.raw.stdout)}</UiText>
				</Box>
			);
		} else {
			body = (
				<Box flexDirection="column">
					<Text bold color="red">
						Dry-run Error
					</Text>
					<UiText>{applyDryRunState.message}</UiText>
				</Box>
			);
		}
	}

	if (page === "preflight-checks") {
		if (preflightState.kind === "running" || preflightState.kind === "idle") {
			body = <UiText>Running preflight checks ...</UiText>;
		} else if (preflightState.kind === "success") {
			const refusals = preflightState.value.warnings;
			body = (
				<Box flexDirection="column">
					<Text bold>Preflight Checks</Text>
					<UiText>{buildApplyCommand(flow.disk, flow.mode, { dryRun: true }).join(" ")}</UiText>
					<UiText> </UiText>
					{refusals.length === 0 ? (
						<UiText>[OK] recpart would apply to this disk.</UiText>
					) : (
						refusals.map((refusal) => <UiText key={refusal}>[FAIL] {refusal}</UiText>)
					)}
					<UiText> </UiText>
					<UiText>
						{arePreflightChecksPassing(preflightState)
							? "All checks passed."
							: "Fail-fast: fix failed checks before continuing."}
					</UiText>
				</Box>
			);
		} else if (preflightState.kind === "error") {
			body = (
				<Box flexDirection="column">
					<Text bold color="red">
						Preflight Error
					</Text>
					<UiText>{preflightState.message}</UiText>
				</Box>
			);
		} else {
			body = (
				<Box flexDirection="column">
					<Text bold color="red">
						Preflight Failure
					</Text>
					<UiText>{limitLines(preflightState.raw.stderr || preflightState.raw.stdout)}</UiText>
				</Box>
			);
		}
	}

	if (page === "destructive-confirm") {
		const unlocked = confirmToken === CONFIRM_TOKEN;
		const target = diskCandidates.find((item) => item.path === flow.disk);
		body = (
			<Box flexDirection="column">
				<Text bold color={unlocked ? "green" : "yellow"}>
					Destructive Apply Confirmation
				</Text>
				<Text bold color="red">
					ALL DATA on {flow.disk || "(unset)"} will be erased.
				</Text>
				<UiText>
					Disk: {flow.disk || "(unset)"} | size:{" "}
					{target && target.size_bytes > 0 ? formatBytes(target.size_bytes) : "?"} | model:{" "}
					{known(target?.model ?? "") ?? "(unknown)"} | serial:{" "}
					{known(target?.serial ?? "") ?? "(unknown)"}
				</UiText>
				<UiText>Mode: {flow.mode}</UiText>
				<UiText> </UiText>
				<UiText>Type token to unlock destructive apply: {CONFIRM_TOKEN}</UiText>
				<UiText>Token: {confirmToken || "(empty)"}</UiText>
				<UiText>{confirmStatusLine(confirmToken)}</UiText>
				<UiText>
					{unlocked
						? "Press Enter to start the destructive apply."
						: "Press Backspace/Delete to edit."}
				</UiText>
			</Box>
		);
	}

	if (page === "apply-progress") {
		if (applyState.kind === "running") {
			body = (
				<Box flexDirection="column">
					<Text bold>Applying Changes</Text>
					<UiText>
						Running:{" "}
						{buildApplyCommand(flow.disk, flow.mode, { dryRun: false, confirmDestroy: true }).join(
							" ",
						)}
					</UiText>
					{applyDryRunState.kind === "success" ? (
						<>
							<UiText> </UiText>
							<Text bold>Step Boundaries</Text>
							{applyDryRunState.value.steps.map((step, index) => (
								<UiText key={`${step.phase}-${index}`}>
									[pending] {step.phase} :: {step.command}
								</UiText>
							))}
						</>
					) : null}
				</Box>
			);
		} else if (applyState.kind === "success") {
			body = (
				<Box flexDirection="column">
					<Text bold color="green">
						Apply Completed
					</Text>
					{applyState.value.steps.map((step, index) => (
						<UiText key={`${step.phase}-${index}`}>
							{progressStepLine(step.phase, step.command, step.status)}
						</UiText>
					))}
					<UiText>Next: result-handoff page</UiText>
				</Box>
			);
		} else if (applyState.kind === "failure") {
			body = (
				<Box flexDirection="column">
					<Text bold color="red">
						Apply Failed
					</Text>
					<UiText>Exit: {applyState.raw.exitCode}</UiText>
					<UiText>{limitLines(applyState.raw.stderr || applyState.raw.stdout)}</UiText>
					<UiText>Next: failure-diagnostics page</UiText>
				</Box>
			);
		} else if (applyState.kind === "error") {
			body = (
				<Box flexDirection="column">
					<Text bold color="red">
						Apply Error
					</Text>
					<UiText>{applyState.message}</UiText>
					<UiText>Next: failure-diagnostics page</UiText>
				</Box>
			);
		} else {
			body = <UiText>Waiting to start apply...</UiText>;
		}
	}

	if (page === "result-handoff") {
		if (applyState.kind !== "success") {
			body = <UiText>No successful apply result available.</UiText>;
		} else {
			const handoff = applyState.value.handoff;
			body = (
				<Box flexDirection="column">
					<Text bold>Handoff</Text>
					<UiText>Install target: {handoff.install_target}</UiText>
					<UiText> </UiText>
					<Text bold>Mount Topology</Text>
					{handoff.mount_map.map((entry) => (
						<UiText key={`${entry.path}-${entry.device}`}>
							{entry.path}
							{" <- "}
							{entry.device}
						</UiText>
					))}
					{handoff.mode_context.install_target_slot ? (
						<UiText>
							A/B slot installed now: {handoff.mode_context.install_target_slot} (slot{" "}
							{handoff.mode_context.inactive_slot_hint} stays unmounted)
						</UiText>
					) : null}
					<UiText> </UiText>
					<Text bold>Next Steps</Text>
					{nextInstallSteps(handoff.install_target).map((step) => (
						<UiText key={step}>{step}</UiText>
					))}
				</Box>
			);
		}
	}

	if (page === "failure-diagnostics") {
		if (!failure) {
			body = <UiText>No failure captured.</UiText>;
		} else {
			const lines = failureDiagnosticLines(failure);
			body = (
				<Box flexDirection="column">
					<Text bold color="red">
						{lines[0]}
					</Text>
					{lines.slice(1).map((line) => (
						<UiText key={line}>{line}</UiText>
					))}
				</Box>
			);
		}
	}

	return (
		<SurfaceFrame
			title="LevitateOS Disk Plan"
			showHeader={false}
			leftWidth={38}
			footer={footer}
			leftPane={{
				title: "Pages",
				titleMode: "inline",
				body: sidebar,
				borderIntent: "sidebarBorder",
				textIntent: "sidebarItemText",
				titleIntent: "sidebarSectionText",
			}}
			rightPane={{
				title: page,
				titleMode: "inline",
				body,
				borderIntent: "cardBorder",
				textIntent: "text",
				titleIntent: "sectionHeading",
			}}
		/>
	);
}
