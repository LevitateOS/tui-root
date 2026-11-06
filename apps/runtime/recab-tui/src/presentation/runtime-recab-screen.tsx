import { Box, Text, useApp } from "ink";

import { useMemo, useRef, useState } from "react";
import {
	KeyValue,
	NavList,
	truncateLines,
	SegmentedStatusLine,
	AppShell,
	UiText,
	keymapStatusSegments,
	scopeStatusSegment,
	textStatusSegment,
	useKeymap,
	useShellLayout,
	useListNavigation,
	type CommandResult,
	useAppName,
	useAsyncTask,
} from "@levitate/tui-kit";

import { readRecabStatus, runRecabCommand } from "../app/recab-runner";

import { RECAB_KEYMAP, RUNTIME_RECAB_ACTIONS, type RuntimeRecabAction } from "../flows";

import type { Status } from "../generated/recab";

import { formatSlot } from "../domain/recab";

/** Results kept in the log. */
const LOG_ENTRIES = 5;

function compactOutput(result: CommandResult): string {
	const combined = [result.stderr.trim(), result.stdout.trim()]
		.filter((value) => value.length > 0)
		.join("\n");
	if (combined.length === 0) {
		return "(no command output)";
	}
	return truncateLines(combined, 10);
}

const STATUS_ROWS: ReadonlyArray<[string, (status: Status) => string]> = [
	["active", (s) => s.active_slot],
	["inactive", (s) => s.inactive_slot],
	["trial_pending", (s) => (s.trial_pending ? "yes" : "no")],
	["next_boot", (s) => formatSlot(s.next_boot)],
	["default", (s) => formatSlot(s.default_slot)],
	["known_good", (s) => formatSlot(s.known_good_slot)],
	["committed", (s) => (s.committed ? "yes" : "no")],
	["rollback", (s) => formatSlot(s.rollback_slot)],
	["entry_prefix", (s) => s.entry_prefix],
];

function statusEntries(status: Status | null): Array<{ key: string; value: string }> {
	return STATUS_ROWS.map(([key, value]) => ({ key, value: status ? value(status) : "(unknown)" }));
}

function exitText(result: CommandResult): string {
	return result.exitCode === null ? "did not run to completion" : `exit ${result.exitCode}`;
}

function formatResultSummary(result: CommandResult): string {
	return `${result.argv.join(" ")} (${exitText(result)}, ${result.durationMs}ms)`;
}

/** One finished recab run, newest first in the log. */
type LogEntry = { label: string; result: CommandResult };

export function RuntimeRecabScreen() {
	const { exit } = useApp();
	const appName = useAppName();
	const nav = useListNavigation(RUNTIME_RECAB_ACTIONS.length, 0);
	const [refreshes, setRefreshes] = useState(0);
	const statusTask = useAsyncTask(String(refreshes), readRecabStatus);
	const [running, setRunning] = useState<RuntimeRecabAction | null>(null);
	const [log, setLog] = useState<readonly LogEntry[]>([]);
	const [notice, setNotice] = useState<string | null>(null);

	const activeAction = RUNTIME_RECAB_ACTIONS[nav.safeIndex] ?? RUNTIME_RECAB_ACTIONS[0];
	const statusRead = statusTask.kind === "done" ? statusTask.value : null;
	const status = statusRead?.kind === "ok" ? statusRead.status : null;
	const statusError =
		statusTask.kind === "error"
			? statusTask.message
			: statusRead?.kind === "failed"
				? statusRead.reason
				: null;
	const isBusy = running !== null;
	// A ref, not state: two keys handled in one batch must not both start a run.
	const busy = useRef(false);

	const runAction = async (action: RuntimeRecabAction) => {
		if (busy.current) {
			return;
		}
		if (action.section === "Read") {
			// The status panel runs `recab status` itself.
			setRefreshes((n) => n + 1);
			return;
		}
		busy.current = true;
		setRunning(action);
		try {
			const result = await runRecabCommand(action.args);
			setLog((entries) => [{ label: action.label, result }, ...entries].slice(0, LOG_ENTRIES));
		} finally {
			busy.current = false;
			setRunning(null);
			setRefreshes((n) => n + 1);
		}
	};

	const runningMutation = running?.section === "Mutating";
	useKeymap(RECAB_KEYMAP, {
		move: (key) => {
			if (!isBusy) {
				nav.moveBy(key === "up" || key === "k" ? -1 : 1);
			}
		},
		run: () => {
			if (activeAction) {
				void runAction(activeAction);
			}
		},
		...Object.fromEntries(
			RUNTIME_RECAB_ACTIONS.map((action) => [action.id, () => void runAction(action)]),
		),
		quit: () => {
			if (runningMutation) {
				setNotice(`can't quit while "${running?.label}" is running`);
				return;
			}
			exit();
		},
	});

	const sidebarItems = useMemo(
		() =>
			RUNTIME_RECAB_ACTIONS.map((action) => ({
				key: action.id,
				section: action.section,
				label: `${action.label} (${action.hotkey})`,
			})),
		[],
	);

	const footer = (
		<SegmentedStatusLine
			segments={[
				scopeStatusSegment(appName),
				running
					? textStatusSegment("busy", `running: ${running.label}`, "warning")
					: textStatusSegment(
							"busy",
							statusTask.kind === "running" ? "reading status" : "idle",
							"accent",
						),
				...keymapStatusSegments(
					RECAB_KEYMAP.filter((b) => ["move", "run", "quit"].includes(b.action)),
				),
				...(statusError ? [textStatusSegment("status", statusError, "error", true)] : []),
				...(notice ? [textStatusSegment("notice", notice, "warning")] : []),
			]}
		/>
	);

	const layout = useShellLayout({ navWidth: 40 });
	const sidebar = (
		<Box flexDirection="column">
			<NavList
				items={sidebarItems}
				selectedIndex={nav.safeIndex}
				width={(layout.nav ?? layout.content).textColumns}
			/>
			<UiText> </UiText>
			<UiText intent="dimText">Mutating actions require root.</UiText>
		</Box>
	);

	const body = (
		<Box flexDirection="column">
			<Text bold>recab Runtime Control Plane</Text>
			<UiText>Runtime actions over the existing recab backend.</UiText>
			<UiText> </UiText>
			<Text bold>Slot State</Text>
			<KeyValue entries={statusEntries(status)} />
			{statusTask.kind === "running" ? <UiText intent="warning">Reading status ...</UiText> : null}
			{statusError ? <UiText intent="error">Status error: {statusError}</UiText> : null}
			<UiText> </UiText>
			<Text bold>Selected Action</Text>
			<UiText>{activeAction.label}</UiText>
			<UiText intent="dimText">{activeAction.description}</UiText>
			<UiText intent="dimText">Command: {`recab ${activeAction.args.join(" ")}`}</UiText>
			<UiText> </UiText>
			<Text bold>Results (newest first)</Text>
			{log.length === 0 ? <UiText intent="dimText">Nothing run yet in this session.</UiText> : null}
			{log.map((entry, i) => (
				<Box key={log.length - i} flexDirection="column">
					<UiText bold={i === 0}>
						{entry.label}: {formatResultSummary(entry.result)}
					</UiText>
					{i === 0 ? <UiText>{compactOutput(entry.result)}</UiText> : null}
				</Box>
			))}
		</Box>
	);

	return (
		<AppShell
			layout={layout}
			focus="navigation"
			navTitle="Actions"
			nav={sidebar}
			contentTitle="recab"
			content={body}
			footer={footer}
		/>
	);
}
