import { Box, Text, useApp } from "ink";
import { useEffect, useMemo, useState } from "react";
import {
	KeyValue,
	SectionList,
	SegmentedStatusLine,
	SurfaceFrame,
	UiText,
	hotkeyStatusSegment,
	scopeStatusSegment,
	textStatusSegment,
	useHotkeys,
	useListNavigation,
} from "@levitate/tui-kit";
import { runRecabCommand, runRecabStatus } from "../app/recab-runner";
import {
	RUNTIME_RECAB_ACTIONS,
	type RuntimeRecabAction,
	type RuntimeRecabActionId,
} from "../flows";
import type { Status } from "../domain/contract";
import { formatSlot, type RecabCommandResult } from "../domain/recab";

type RuntimeRecabScreenProps = {
	recabBin: string;
};

function compactOutput(result: RecabCommandResult, maxLines = 10): string {
	const combined = [result.stderr.trim(), result.stdout.trim()]
		.filter((value) => value.length > 0)
		.join("\n");
	if (combined.length === 0) {
		return "(no command output)";
	}
	const lines = combined.split(/\r?\n/);
	if (lines.length <= maxLines) {
		return combined;
	}
	return `${lines.slice(0, maxLines).join("\n")}\n... (${lines.length - maxLines} more lines)`;
}

const STATUS_ROWS: ReadonlyArray<[string, (status: Status) => string]> = [
	["active", (s) => s.active_slot],
	["inactive", (s) => s.inactive_slot],
	["trial_pending", (s) => (s.trial_pending ? "yes" : "no")],
	["next_boot", (s) => formatSlot(s.next_boot)],
	["default", (s) => formatSlot(s.default_slot)],
	["known_good", (s) => formatSlot(s.known_good_slot)],
	["entry_prefix", (s) => s.entry_prefix],
];

function statusEntries(status: Status | null): Array<{ key: string; value: string }> {
	return STATUS_ROWS.map(([key, value]) => ({ key, value: status ? value(status) : "(unknown)" }));
}

function exitText(result: RecabCommandResult): string {
	return result.exitCode === null ? "did not run to completion" : `exit ${result.exitCode}`;
}

function formatResultSummary(result: RecabCommandResult | null): string {
	if (!result) {
		return "No command executed in this session.";
	}
	const args = result.args.join(" ");
	return `${result.command} ${args} (${exitText(result)}, ${result.durationMs}ms)`;
}

export function RuntimeRecabScreen({ recabBin }: RuntimeRecabScreenProps) {
	const { exit } = useApp();
	const nav = useListNavigation(RUNTIME_RECAB_ACTIONS.length, 0);
	const [status, setStatus] = useState<Status | null>(null);
	const [statusLoading, setStatusLoading] = useState(true);
	const [statusError, setStatusError] = useState<string | null>(null);
	const [runningActionId, setRunningActionId] = useState<RuntimeRecabActionId | null>(null);
	const [lastResult, setLastResult] = useState<RecabCommandResult | null>(null);
	const [notice, setNotice] = useState<string>("Loading recab status...");

	const activeAction = RUNTIME_RECAB_ACTIONS[nav.safeIndex] ?? RUNTIME_RECAB_ACTIONS[0];
	const isBusy = statusLoading || runningActionId !== null;

	const refreshStatus = async () => {
		setStatusLoading(true);
		const { result, status: parsed, parseError } = await runRecabStatus({ recabBin });
		setLastResult(result);

		if (result.exitCode !== 0) {
			setStatusError(`status failed (${exitText(result)})`);
			setNotice(`status failed (${exitText(result)})`);
			setStatusLoading(false);
			return;
		}
		if (parseError || !parsed) {
			setStatusError(parseError ?? "status JSON parse failed");
			setNotice("status parse failed");
			setStatusLoading(false);
			return;
		}

		setStatus(parsed);
		setStatusError(null);
		setNotice("status refreshed");
		setStatusLoading(false);
	};

	const runAction = async (action: RuntimeRecabAction) => {
		if (isBusy) {
			return;
		}
		if (action.id === "status-refresh") {
			await refreshStatus();
			return;
		}
		setRunningActionId(action.id);
		setNotice(`running recab ${action.args.join(" ")}`);

		const result = await runRecabCommand({
			recabBin,
			args: action.args,
		});
		setLastResult(result);
		if (result.exitCode === 0) {
			setNotice(`recab ${action.args[0]} succeeded`);
			await refreshStatus();
		} else {
			setNotice(`recab ${action.args[0]} failed (${exitText(result)})`);
		}
		setRunningActionId(null);
	};

	const runActionById = (id: RuntimeRecabActionId) => {
		const action = RUNTIME_RECAB_ACTIONS.find((item) => item.id === id);
		if (!action) {
			return;
		}
		void runAction(action);
	};

	useEffect(() => {
		void refreshStatus();
	}, [recabBin]);

	useHotkeys(["q", "escape", "C-c"], () => exit());
	useHotkeys(["down", "j"], () => {
		if (!isBusy) {
			nav.moveBy(1);
		}
	});
	useHotkeys(["up", "k"], () => {
		if (!isBusy) {
			nav.moveBy(-1);
		}
	});
	useHotkeys(["enter"], () => {
		if (!activeAction) {
			return;
		}
		void runAction(activeAction);
	});
	// One hotkey per action; the action table is static, so the hook order is too.
	for (const action of RUNTIME_RECAB_ACTIONS) {
		useHotkeys([action.hotkey], () => runActionById(action.id));
	}

	const sidebarItems = useMemo(
		() =>
			RUNTIME_RECAB_ACTIONS.map((action) => ({
				section: action.section,
				label: `${action.label} (${action.hotkey})`,
			})),
		[],
	);

	const footer = useMemo(() => {
		const segments = [
			scopeStatusSegment("recab-tui"),
			textStatusSegment("recab-bin", `bin=${recabBin}`, "dimText"),
			textStatusSegment(
				"busy",
				runningActionId ? `running=${runningActionId}` : statusLoading ? "refreshing" : "idle",
				runningActionId || statusLoading ? "warning" : "accent",
			),
			hotkeyStatusSegment("move", "j/k", "select"),
			hotkeyStatusSegment("run", "enter", "execute"),
			hotkeyStatusSegment(
				"quick",
				RUNTIME_RECAB_ACTIONS.map((action) => action.hotkey).join("/"),
				"actions",
			),
			hotkeyStatusSegment("quit", "q", "quit"),
		];
		if (statusError) {
			segments.push(textStatusSegment("status-error", "status-error", "error", true));
		}
		return <SegmentedStatusLine segments={segments} />;
	}, [recabBin, runningActionId, statusError, statusLoading]);

	const sidebar = (
		<Box flexDirection="column">
			<SectionList
				items={sidebarItems}
				selectedIndex={nav.safeIndex}
				maxWidth={36}
				sectionPrefix="::"
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
			{statusLoading ? <UiText intent="warning">Refreshing status ...</UiText> : null}
			{statusError ? <UiText intent="error">Status error: {statusError}</UiText> : null}
			<UiText> </UiText>
			<Text bold>Selected Action</Text>
			<UiText>{activeAction.label}</UiText>
			<UiText intent="dimText">{activeAction.description}</UiText>
			<UiText intent="dimText">Command: {`${recabBin} ${activeAction.args.join(" ")}`}</UiText>
			<UiText> </UiText>
			<Text bold>Last Command</Text>
			<UiText>{formatResultSummary(lastResult)}</UiText>
			<UiText intent="dimText">{notice}</UiText>
			<UiText>{lastResult ? compactOutput(lastResult) : "(no command output)"}</UiText>
		</Box>
	);

	return (
		<SurfaceFrame
			title="LevitateOS Runtime Tools"
			showHeader={false}
			leftWidth={40}
			footer={footer}
			leftPane={{
				title: "Actions",
				titleMode: "inline",
				body: sidebar,
				borderIntent: "sidebarBorder",
				textIntent: "sidebarItemText",
				titleIntent: "sidebarSectionText",
			}}
			rightPane={{
				title: "recab",
				titleMode: "inline",
				body,
				borderIntent: "cardBorder",
				textIntent: "text",
				titleIntent: "sectionHeading",
			}}
		/>
	);
}
