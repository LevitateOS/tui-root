/** The pages: the slots at a glance, one change before and after it runs, and the runs
 * so far. */
import { Box, Text } from "ink";
import { useContext, type ReactNode } from "react";
import {
	Callout,
	Commands,
	ContentWidth,
	Facts,
	Heading,
	inkBorderStyle,
	resolveIntentColor,
	Section,
	Table,
	truncateLines,
	UiText,
	useTuiColors,
	useTuiTheme,
	type ColorIntent,
	type CommandResult,
} from "@levitate/tui-kit";
import { SLOTS, type Slot, type Status } from "../generated/recab";
import { STATUS_ROWS, type ActionPlan, type Change } from "../domain/actions";
import {
	bootOrder,
	formatTime,
	headline,
	recabError,
	slotTags,
	type RecabError,
} from "../domain/recab";
import type { StatusRead } from "../app/recab-runner";
import { FIELD_QUESTION, type Prompt, type Run } from "./use-recab";

function useIntent(intent: ColorIntent): string | undefined {
	return resolveIntentColor(useTuiTheme(), intent, useTuiColors());
}

/** The two slots side by side (one above the other when narrow), each with its part in
 * the machine's state. */
function SlotCards({ status }: { status: Status }): ReactNode {
	const width = useContext(ContentWidth);
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const side = width >= 44;
	const cards = SLOTS.map((slot) => ({ slot, tags: slotTags(status, slot) }));
	const lines = Math.max(...cards.map((card) => card.tags.length));
	return (
		<Box flexDirection={side ? "row" : "column"} columnGap={1} marginBottom={1}>
			{cards.map(({ slot, tags }) => {
				const running = slot === status.active_slot;
				const edge = resolveIntentColor(theme, running ? "accent" : "panelBorder", colors);
				return (
					<Box
						key={slot}
						flexDirection="column"
						width={side ? Math.floor((width - 1) / 2) : width}
						borderStyle={inkBorderStyle(theme.chrome.borderGlyphSet)}
						borderColor={edge}
						paddingX={1}
					>
						<Text bold color={edge}>
							{running ? "● " : "○ "}Slot {slot}
						</Text>
						{tags.map((tag) => (
							<Text key={tag.text} color={resolveIntentColor(theme, tag.intent, colors)}>
								{tag.text}
							</Text>
						))}
						{Array.from({ length: lines - tags.length }, (_, i) => (
							<Text key={`pad${i}`}> </Text>
						))}
					</Box>
				);
			})}
		</Box>
	);
}

function ErrorCallout({
	title,
	error,
	detail,
	tone = "danger",
}: {
	title: string;
	error: RecabError;
	/** A dim line under the message, e.g. the command that ran. */
	detail?: string;
	tone?: "danger" | "warning";
}): ReactNode {
	return (
		<Callout tone={tone} title={title}>
			<UiText>{error.message}</UiText>
			{error.help ? <UiText bold>{error.help}</UiText> : null}
			<UiText intent="dimText">{[detail, error.tag].filter(Boolean).join(" · ")}</UiText>
		</Callout>
	);
}

export function OverviewPage({
	status,
	plans,
}: {
	status: StatusRead;
	plans: readonly ActionPlan[];
}): ReactNode {
	if (status.kind === "reading")
		return (
			<Box flexDirection="column">
				<Heading title="A/B slots" />
				<UiText intent="dimText">Reading the slots with recab status …</UiText>
			</Box>
		);
	if (status.kind === "failed")
		return (
			<Box flexDirection="column">
				<Heading title="A/B slots" />
				<ErrorCallout title="recab couldn't read the A/B state" error={status.error} />
				<UiText intent="dimText">r reads it again.</UiText>
			</Box>
		);
	const s = status.status;
	const head = headline(s);
	const trial = s.last_trial;
	return (
		<Box flexDirection="column">
			<Heading
				title="A/B slots"
				subtitle={`${s.entry_prefix} boots from one slot; an update is written to the other and tried once before it is kept.`}
			/>
			<Callout tone={head.tone} title={head.title}>
				{head.lines.map((line) => (
					<UiText key={line}>{line}</UiText>
				))}
			</Callout>
			<SlotCards status={s} />
			<Section title="Boot order">
				<Facts rows={bootOrder(s)} />
			</Section>
			{trial ? (
				<Section title="Last trial" trailing={formatTime(trial.unix_time)}>
					<UiText bold intent={trial.committed ? "success" : "error"}>
						{trial.committed
							? `Slot ${trial.slot} started healthy and was kept`
							: `Slot ${trial.slot} failed its trial and was left`}
					</UiText>
					<UiText intent="dimText">{trial.detail}</UiText>
				</Section>
			) : null}
			<Section title="Changes">
				<PlanList plans={plans} />
			</Section>
		</Box>
	);
}

/** Every change with whether recab would make it now, and why not. */
function PlanList({ plans }: { plans: readonly ActionPlan[] }): ReactNode {
	const dim = useIntent("dimText");
	return (
		<Box flexDirection="column">
			{plans.map((plan) => (
				<Box key={plan.id} flexDirection="column">
					<Text>
						<VerdictMark plan={plan} /> <Text bold>{plan.label}</Text>
					</Text>
					{plan.verdict.kind !== "ready" ? (
						<Box paddingLeft={2}>
							<Text color={dim}>{plan.verdict.reason}</Text>
						</Box>
					) : null}
				</Box>
			))}
		</Box>
	);
}

const VERDICT_MARK: Record<ActionPlan["verdict"]["kind"], { mark: string; intent: ColorIntent }> = {
	ready: { mark: "●", intent: "success" },
	"no-change": { mark: "○", intent: "dimText" },
	refused: { mark: "✗", intent: "warning" },
};

export function VerdictMark({ plan }: { plan: ActionPlan | null }): ReactNode {
	const { mark, intent } = plan
		? VERDICT_MARK[plan.verdict.kind]
		: { mark: "·", intent: "dimText" as const };
	return <Text color={useIntent(intent)}>{mark}</Text>;
}

function ChangeTable({ changes }: { changes: readonly Change[] }): ReactNode {
	return (
		<Table
			columns={[{ title: "" }, { title: "Now" }, { title: "After" }]}
			tones={changes.map((c) => (c.before === c.after ? "dimText" : null))}
			rows={changes.map((c) => [c.what, c.before, c.before === c.after ? "(stays)" : c.after])}
		/>
	);
}

/** The question being asked, with what an answer may be. */
function PromptBox({ prompt, slot }: { prompt: Prompt; slot: Slot | null }): ReactNode {
	const dim = useIntent("dimText");
	const bad = useIntent("warning");
	if (prompt.kind === "confirm")
		return (
			<Callout tone="info" title={`Run ${prompt.argv.join(" ")}?`}>
				<UiText>y runs it · n or Esc cancels</UiText>
			</Callout>
		);
	const field = prompt.kind === "path" ? prompt.field : null;
	return (
		<Callout
			tone={prompt.kind === "token" ? "danger" : "info"}
			title={
				prompt.kind === "token"
					? `Type ${prompt.slot} to erase slot ${prompt.slot} and write it`
					: FIELD_QUESTION[field!]
			}
		>
			<Text>
				<Text color={dim}>› </Text>
				<Text bold>{prompt.text}</Text>
				<Text color={dim}>_</Text>
				{prompt.kind === "path" && prompt.error ? (
					<Text color={bad}>{`   ${prompt.error}`}</Text>
				) : null}
			</Text>
			<UiText intent="dimText">
				{prompt.kind === "token"
					? `Everything on slot ${slot ?? prompt.slot} is erased. Esc cancels.`
					: "Tab completes the path · Enter accepts · Esc cancels"}
			</UiText>
		</Callout>
	);
}

function exitText(result: CommandResult): string {
	return result.exitCode === null ? "didn't start" : `exit ${result.exitCode}`;
}

function seconds(ms: number): string {
	return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;
}

function changed(before: Status, after: Status): boolean {
	return STATUS_ROWS.some(([, value]) => value(before) !== value(after));
}

/** A finished run: what came of it, and the slots before and after. */
function RunResult({ run, plan }: { run: Run; plan: ActionPlan }): ReactNode {
	const result = run.result!;
	const ok = result.exitCode === 0;
	const after = run.after?.kind === "ok" ? run.after.status : null;
	const output = [result.stdout.trim(), ok ? result.stderr.trim() : ""].filter(Boolean).join("\n");
	return (
		<Box flexDirection="column">
			{ok ? (
				<Callout tone="success" title={plan.done}>
					<UiText intent="dimText">{`${run.argv.join(" ")} · ${seconds(result.durationMs)}`}</UiText>
				</Callout>
			) : (
				// Exit 21 is a refusal: recab checked first and changed nothing.
				<ErrorCallout
					title={
						result.exitCode === 21
							? `recab refused: ${plan.title.charAt(0).toLowerCase()}${plan.title.slice(1)}`
							: `${plan.title} failed (${exitText(result)})`
					}
					tone={result.exitCode === 21 ? "warning" : "danger"}
					detail={run.argv.join(" ")}
					error={recabError(result)}
				/>
			)}
			{run.before && after && !changed(run.before, after) ? (
				<Box marginBottom={1}>
					<UiText intent="dimText">The slots are as they were before.</UiText>
				</Box>
			) : run.before && after ? (
				<Section title="Before and after">
					<Table
						columns={[{ title: "" }, { title: "Before" }, { title: "After" }]}
						tones={STATUS_ROWS.map(([, value]) =>
							value(run.before!) === value(after) ? "dimText" : "accent",
						)}
						rows={STATUS_ROWS.map(([label, value]) => [label, value(run.before!), value(after)])}
					/>
				</Section>
			) : null}
			{output ? (
				<Section title="Output">
					<UiText>{truncateLines(output, 8)}</UiText>
				</Section>
			) : null}
		</Box>
	);
}

export function ActionPage({
	plan,
	prompt,
	run,
	now,
	followUp,
}: {
	plan: ActionPlan | null;
	prompt: Prompt | null;
	/** This change's latest run. */
	run: Run | null;
	now: number;
	/** The change that usually follows, with its key. */
	followUp: { key: string; title: string } | null;
}): ReactNode {
	if (!plan)
		return (
			<Box flexDirection="column">
				<Heading title="No status" />
				<UiText intent="dimText">
					recab status hasn't been read, so no change can be planned.
				</UiText>
			</Box>
		);
	const asking = prompt?.kind === "path" ? prompt : null;
	const answers = asking?.answers ?? null;
	const argv =
		plan.argv ??
		(prompt?.kind === "token"
			? prompt.argv
			: run && !run.result
				? run.argv
				: ["recab", "stage", "--rootfs", "<image>", "--kernel", "<vmlinuz>", "[--initrd <img>]"]);
	return (
		<Box flexDirection="column">
			<Heading title={plan.title} subtitle={plan.summary} />
			{prompt ? <PromptBox prompt={prompt} slot={null} /> : null}
			{run && !run.result ? (
				<Callout tone="info" title={`Running ${run.argv.join(" ")} …`}>
					<UiText intent="dimText">{`${seconds(Math.max(0, now - run.startedAt))} so far`}</UiText>
				</Callout>
			) : null}
			{run?.result ? <RunResult run={run} plan={plan} /> : null}
			{run?.result && plan.verdict.kind !== "ready" ? (
				// Done: what comes next, not a plan that no longer applies.
				followUp ? (
					<UiText>
						<Text bold>{followUp.key}</Text>
						{` goes to ${followUp.title}.`}
					</UiText>
				) : null
			) : (
				<>
					{plan.verdict.kind === "refused" ? (
						<Callout tone="warning" title="recab would refuse this now">
							<UiText>{plan.verdict.reason}</UiText>
						</Callout>
					) : plan.verdict.kind === "no-change" ? (
						<Callout tone="info" title="Nothing to change">
							<UiText>{plan.verdict.reason}</UiText>
						</Callout>
					) : plan.destructive && !prompt && !(run && !run.result) ? (
						<Callout
							tone="danger"
							title={`This formats ${plan.changes[0]!.what.replace("Slot", "slot")}`}
						>
							<UiText>
								Everything on it is erased, including the system it holds now. You type its name to
								confirm.
							</UiText>
						</Callout>
					) : null}
					<Section title={run?.result ? "Doing it again" : "What changes"}>
						<ChangeTable changes={plan.changes} />
					</Section>
					{answers ? (
						<Section title="Answers">
							<Facts
								rows={(["rootfs", "kernel", "initrd"] as const).map((field) => [
									field,
									answers[field] ||
										(field === asking?.field ? "(answering)" : field === "initrd" ? "" : "…"),
								])}
							/>
						</Section>
					) : null}
					<Section title="Command">
						<Commands lines={[argv.join(" ")]} />
					</Section>
					{plan.verdict.kind === "ready" && !prompt && !(run && !run.result) ? (
						<UiText intent="dimText">Enter runs it; you confirm before anything changes.</UiText>
					) : null}
				</>
			)}
		</Box>
	);
}

export function HistoryPage({ runs, now }: { runs: readonly Run[]; now: number }): ReactNode {
	const latest = runs.find((run) => run.result) ?? null;
	return (
		<Box flexDirection="column">
			<Heading
				title="History"
				subtitle="What ran in this session, newest first. recab keeps its own log in /var/lib/recab/audit.log."
			/>
			{runs.length === 0 ? (
				<UiText intent="dimText">Nothing has run yet.</UiText>
			) : (
				<Section title="Runs" trailing={`${runs.length}`}>
					<Table
						columns={[
							{ title: "Started" },
							{ title: "Command" },
							{ title: "Result" },
							{ title: "Took", align: "right", optional: true },
						]}
						tones={runs.map((run) =>
							!run.result ? "warning" : run.result.exitCode === 0 ? "success" : "error",
						)}
						rows={runs.map((run) => [
							new Date(run.startedAt).toTimeString().slice(0, 8),
							run.argv.join(" "),
							run.result ? (run.result.exitCode === 0 ? "done" : exitText(run.result)) : "running",
							seconds((run.result?.durationMs ?? now - run.startedAt) || 0),
						])}
					/>
				</Section>
			)}
			{latest?.result && latest.result.exitCode !== 0 ? (
				<ErrorCallout
					title={`Last failure: ${latest.argv.join(" ")}`}
					error={recabError(latest.result)}
				/>
			) : null}
		</Box>
	);
}
