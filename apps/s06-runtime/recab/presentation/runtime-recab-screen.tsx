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
import { RUNTIME_RECAB_ACTIONS, type RuntimeRecabAction, type RuntimeRecabActionId } from "../flows";
import { formatSlot, type RecabCommandResult, type RecabStatus } from "../domain";

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

function statusEntries(status: RecabStatus | null): Array<{ key: string; value: string }> {
	if (!status) {
		return [
			{ key: "active", value: "(unknown)" },
			{ key: "inactive", value: "(unknown)" },
			{ key: "trial_pending", value: "(unknown)" },
			{ key: "next_boot", value: "(unknown)" },
			{ key: "default", value: "(unknown)" },
			{ key: "known_good", value: "(unknown)" },
			{ key: "entry_prefix", value: "(unknown)" },
		];
	}
	return [
		{ key: "active", value: status.activeSlot },
		{ key: "inactive", value: status.inactiveSlot },
		{ key: "trial_pending", value: status.trialPending ? "yes" : "no" },
		{ key: "next_boot", value: formatSlot(status.nextBoot) },
		{ key: "default", value: formatSlot(status.defaultSlot) },
		{ key: "known_good", value: formatSlot(status.knownGoodSlot) },
		{ key: "entry_prefix", value: status.entryPrefix },
	];
}

function formatResultSummary(result: RecabCommandResult | null): string {
	if (!result) {
		return "No command executed in this session.";
	}
	const args = result.args.join(" ");
	return `${result.command} ${args} (exit ${result.exitCode}, ${result.durationMs}ms)`;
}

export function RuntimeRecabScreen({ recabBin }: RuntimeRecabScreenProps) {
	const { exit } = useApp();
	const nav = useListNavigation(RUNTIME_RECAB_ACTIONS.length, 0);
	const [status, setStatus] = useState<RecabStatus | null>(null);
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
			setStatusError(`status failed (exit ${result.exitCode})`);
			setNotice(`status failed (exit ${result.exitCode})`);
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
		setRunningActionId(action.id);
		setNotice(`running ${action.command.args.join(" ")}`);

		const result = await runRecabCommand({
			recabBin,
			args: action.command.args,
		});
		setLastResult(result);
		if (result.exitCode === 0) {
			setNotice(`${action.command.command} succeeded`);
			await refreshStatus();
		} else {
			setNotice(`${action.command.command} failed (exit ${result.exitCode})`);
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
	useHotkeys(["r"], () => {
		if (isBusy) {
			return;
		}
		void refreshStatus();
	});
	useHotkeys(["a"], () => runActionById("set-next-a"));
	useHotkeys(["b"], () => runActionById("set-next-b"));
	useHotkeys(["c"], () => runActionById("commit"));
	useHotkeys(["x"], () => runActionById("rollback"));

	const sidebarItems = useMemo(
		() =>
			RUNTIME_RECAB_ACTIONS.map((action) => ({
				section: action.section,
				label: `${action.label} (${action.hotkeyHint})`,
			})),
		[],
	);

	const footer = useMemo(() => {
		const segments = [
			scopeStatusSegment("s06-runtime"),
			textStatusSegment("recab-bin", `bin=${recabBin}`, "dimText"),
			textStatusSegment(
				"busy",
				runningActionId ? `running=${runningActionId}` : statusLoading ? "refreshing" : "idle",
				runningActionId || statusLoading ? "warning" : "accent",
			),
			hotkeyStatusSegment("move", "j/k", "select"),
			hotkeyStatusSegment("run", "enter", "execute"),
			hotkeyStatusSegment("refresh", "r", "status"),
			hotkeyStatusSegment("quick", "a/b/c/x", "slot ops"),
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
			<UiText>Stage 06 runtime actions over existing recab backend.</UiText>
			<UiText> </UiText>
			<Text bold>Slot State</Text>
			<KeyValue entries={statusEntries(status)} />
			{statusLoading ? <UiText intent="warning">Refreshing status ...</UiText> : null}
			{statusError ? <UiText intent="error">Status error: {statusError}</UiText> : null}
			<UiText> </UiText>
			<Text bold>Selected Action</Text>
			<UiText>{activeAction.label}</UiText>
			<UiText intent="dimText">{activeAction.description}</UiText>
			<UiText intent="dimText">Command: {`${recabBin} ${activeAction.command.args.join(" ")}`}</UiText>
			<UiText> </UiText>
			<Text bold>Last Command</Text>
			<UiText>{formatResultSummary(lastResult)}</UiText>
			<UiText intent="dimText">{notice}</UiText>
			<UiText>{lastResult ? compactOutput(lastResult) : "(no command output)"}</UiText>
		</Box>
	);

	return (
		<SurfaceFrame
			title="LevitateOS S06 Runtime Tools"
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
