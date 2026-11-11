/** The pages: every one is built on the two slots drawn as two blocks, with a change
 * shown before it runs, while it runs and as it left the slots, and the runs so far. */
import { Box, Text } from "ink";
import { useContext, type ReactNode } from "react";
import {
	Callout,
	CellGrid,
	CellRows,
	Commands,
	ContentWidth,
	Facts,
	Field,
	Heading,
	Table,
	truncateLine,
	truncateLines,
	useIntentColor,
	useSurfaceBackground,
	WordSlots,
	type ColorIntent,
	type CommandResult,
} from "@levitate/tui-kit";
import type { Slot, Status } from "../generated/recab";
import { planAction, type ActionPlan, type Change } from "../domain/actions";
import {
	formatTime,
	headline,
	recabError,
	slotBlock,
	type RecabError,
	type SlotBlock,
} from "../domain/recab";
import type { StatusRead } from "../app/recab-runner";
import { type Prompt, type Run } from "./use-recab";

/** A line of text on the surface it sits on. */
function Line({
	children,
	intent = "text",
	bold = false,
}: {
	children: ReactNode;
	intent?: ColorIntent;
	bold?: boolean;
}): ReactNode {
	const color = useIntentColor();
	return (
		<Text bold={bold} color={color(intent)} backgroundColor={color(useSurfaceBackground())}>
			{children}
		</Text>
	);
}

const BLOCK_ROWS = 5;
const BLOCK_GAP = 3;
/** The content width the fork needs to draw its two ways out beside the chip. */
const FORK_WIDE = 64;

const BAR: Record<SlotBlock["state"], ColorIntent> = {
	running: "accent",
	next: "highlight",
	idle: "panelBorder",
};

/** The slots as blocks side by side: a bar in the slot's state with its letter and its
 * part in the next boot, then what it is and where it stands. */
function SlotBlocks({ blocks }: { blocks: readonly SlotBlock[] }): ReactNode {
	const width = useContext(ContentWidth);
	const grid = new CellGrid(width, BLOCK_ROWS + 1, useSurfaceBackground());
	const each = Math.floor((width - BLOCK_GAP * (blocks.length - 1)) / blocks.length);
	blocks.forEach((block, i) => {
		const x = i * (each + BLOCK_GAP);
		const lit = block.state !== "idle";
		for (let row = 0; row < BLOCK_ROWS; row++) grid.fill(row, x, each, "raisedBackground");
		grid.fill(0, x, each, BAR[block.state]);
		grid.put(0, x + 2, block.slot, lit ? "contentBackground" : "text", undefined, true);
		if (block.tag)
			grid.put(
				0,
				x + each - block.tag.length - 2,
				block.tag,
				lit ? "contentBackground" : "dimText",
				undefined,
				lit,
			);
		const room = each - 4;
		const device = block.device && block.device.length + 2 < room ? block.device : "";
		grid.put(2, x + 2, truncateLine(block.role, room - (device ? device.length + 1 : 0)), "text");
		if (device) grid.put(2, x + each - 2 - device.length, device, "dimText");
		grid.put(3, x + 2, truncateLine(block.standing.text, room), block.standing.intent);
	});
	return <CellRows grid={grid} />;
}

/** Both slots of a status as blocks. */
function StatusBlocks({ status }: { status: Status }): ReactNode {
	return <SlotBlocks blocks={[slotBlock(status, "A"), slotBlock(status, "B")]} />;
}

/** A trial boot as a fork: one line in, two ways out. */
function Fork({ target, fallback }: { target: Slot; fallback: Slot }): ReactNode {
	const width = useContext(ContentWidth);
	const grid = new CellGrid(width, 3, useSurfaceBackground());
	grid.put(0, 0, "reboot ─▶", "dimText");
	const chip = ` slot ${target}, once `;
	const after = grid.put(0, 10, chip, "contentBackground", "highlight", true);
	if (width < FORK_WIDE) {
		// Narrow: the two ways out hang under the chip instead of beside it.
		const healthy = grid.put(1, 10, "├─ starts healthy ─▶", "faintText");
		grid.put(1, healthy + 1, `${target} is kept`, "success", undefined, true);
		const second = grid.put(2, 10, "└─ does not ──────▶", "faintText");
		grid.put(2, second + 1, `slot ${fallback}`, "text", undefined, true);
		return <CellRows grid={grid} />;
	}
	const branch = after + 1;
	const healthy = grid.put(0, branch, "─┬─ starts healthy ─▶", "faintText");
	grid.put(0, healthy + 1, `${target} is kept`, "success", undefined, true);
	const second = grid.put(1, branch + 1, "└─ does not ──────▶", "faintText");
	grid.put(1, second + 1, `back to slot ${fallback}`, "text", undefined, true);
	return <CellRows grid={grid} />;
}

/** The line under the blocks: what boots next, and where a roll back goes. */
function BootLine({ status }: { status: Status }): ReactNode {
	const width = useContext(ContentWidth);
	const grid = new CellGrid(width, 1, useSurfaceBackground());
	const narrow = width < FORK_WIDE;
	let at = grid.put(0, 0, "Next boot  ", "dimText");
	at = grid.put(
		0,
		at,
		status.next_boot ? `slot ${status.next_boot}` : "none",
		"text",
		undefined,
		true,
	);
	at = grid.put(0, at, narrow ? "    Roll back to  " : "      Roll back goes to  ", "dimText");
	grid.put(
		0,
		at,
		status.rollback_slot ? `slot ${status.rollback_slot}` : "nowhere",
		"text",
		undefined,
		true,
	);
	return <CellRows grid={grid} />;
}

function Gap(): ReactNode {
	return <Box height={1} />;
}

function ErrorPanel({
	tone = "danger",
	title,
	error,
}: {
	tone?: "danger" | "warning";
	title: string;
	error: RecabError;
}): ReactNode {
	return (
		<Callout tone={tone} title={title}>
			<Line>{error.message}</Line>
			{error.help ? <Line bold>{error.help}</Line> : null}
			{error.tag ? <Line intent="dimText">{error.tag}</Line> : null}
		</Callout>
	);
}

export function OverviewPage({ status }: { status: StatusRead }): ReactNode {
	if (status.kind === "reading")
		return (
			<Box flexDirection="column">
				<Heading title="Reading the slots" subtitle="Asking recab status for the A/B state." />
			</Box>
		);
	if (status.kind === "failed")
		return (
			<Box flexDirection="column">
				<Heading
					glyph="bang"
					tone="error"
					title="No slots to show"
					subtitle="recab couldn't read the A/B state."
				/>
				<NoSlots error={status.error} />
			</Box>
		);
	const s = status.status;
	const head = headline(s);
	const trial = s.lifecycle.trial_current ? s.last_trial : null;
	const trialPending = s.trial_pending && s.next_boot;
	return (
		<Box flexDirection="column">
			{trialPending ? (
				<Heading
					title={`Slot ${s.next_boot} boots next, once`}
					subtitle="A trial: kept if it starts healthy, undone if it does not."
				/>
			) : head.tone === "success" ? (
				<Heading
					title="Two systems, one running"
					subtitle="An update is written to the other slot and tried once before it is kept."
				/>
			) : (
				<Heading title={head.title} subtitle={head.lines.join(" ")} />
			)}
			<StatusBlocks status={s} />
			<Facts
				rows={[
					["Lifecycle", s.lifecycle.state],
					["Running release", s.running_release ?? "unknown"],
					["Candidate release", s.prepared_release ?? "none"],
					[
						"Preparation",
						s.preparation
							? `slot ${s.preparation.slot} · ${s.preparation.id} · revision ${s.preparation.revision} · ${s.preparation.phase}`
							: "none",
					],
					["Reboot needed", s.lifecycle.reboot_needed ? "yes" : "no"],
					["Update", s.updates?.phase ?? "unknown"],
				]}
			/>
			{s.recovery_reason ? <Line intent="error">{s.recovery_reason}</Line> : null}
			{s.updates?.last_error ? <Line intent="warning">{s.updates.last_error}</Line> : null}
			{s.updates?.available ? (
				<Line>{`Available: ${s.updates.available.version} · ${s.updates.available.total_bytes} bytes`}</Line>
			) : null}
			{s.updates?.download ? (
				<Line>{`${s.updates.download.verified_bytes}/${s.updates.download.total_bytes} verified bytes${s.updates.download.downloaded ? " · downloaded" : ""}`}</Line>
			) : null}
			{s.preparation?.changes.map((c) => (
				<Line key={c.id}>{`${c.action} ${c.package} · ${c.actor ?? "person"}`}</Line>
			))}
			{s.preparation?.change ? (
				<Line intent="warning">{`Pending change: ${s.preparation.change.package} · ${s.preparation.change.action}`}</Line>
			) : null}
			{s.updates?.merge?.conflicts
				.filter((c) => !c.resolution)
				.map((c) => (
					<Line key={c.id} intent="warning">{`${c.path}: ${c.kind}`}</Line>
				))}

			{trialPending ? (
				<Fork target={s.next_boot!} fallback={s.known_good_slot ?? s.active_slot} />
			) : (
				<BootLine status={s} />
			)}
			{trial && !trialPending ? (
				<>
					<Gap />
					<Line intent="dimText">
						{`Slot ${trial.slot}'s last trial ${trial.committed ? "was kept" : "failed"} (${formatTime(trial.unix_time)}): ${trial.detail}`}
					</Line>
				</>
			) : null}
		</Box>
	);
}

/** One block for a system recab found no slots on, and recab's own reason. */
function NoSlots({ error }: { error: RecabError }): ReactNode {
	const width = useContext(ContentWidth);
	const grid = new CellGrid(width, BLOCK_ROWS + 1, useSurfaceBackground());
	for (let row = 0; row < BLOCK_ROWS; row++) grid.fill(row, 0, width, "raisedBackground");
	grid.fill(0, 0, width, "panelBorder");
	grid.put(0, 2, "no slots", "text", undefined, true);
	grid.put(2, 2, truncateLine(error.message, width - 4), "text");
	if (error.help) grid.put(3, 2, truncateLine(error.help, width - 4), "info");
	return (
		<>
			<CellRows grid={grid} />
			{error.tag ? <Line intent="dimText">{error.tag}</Line> : null}
		</>
	);
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

function PathQuestions({ prompt }: { prompt: Extract<Prompt, { kind: "path" }> }): ReactNode {
	const width = useContext(ContentWidth);
	const field = prompt.plan.inputs[prompt.index]!;
	return (
		<Box flexDirection="column">
			<Line bold>{field.label}</Line>
			{field.choices.length ? <Line>{field.choices.join(" / ")}</Line> : null}
			<Field label={field.name} text={prompt.text} width={width} />
			{prompt.error ? (
				<Line intent="warning">{prompt.error}</Line>
			) : (
				<Line intent="dimText">
					Enter accepts · Esc cancels{field.required ? "" : " · optional"}
				</Line>
			)}
		</Box>
	);
}

function seconds(ms: number): string {
	return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;
}

function elapsed(ms: number): string {
	const total = Math.max(0, Math.round(ms / 1000));
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function exitText(result: CommandResult): string {
	return result.exitCode === null ? "didn't start" : `exit ${result.exitCode}`;
}

/** The first sentence of a result line, and what follows it. */
function splitSentence(text: string): [string, string] {
	const at = text.indexOf(". ");
	return at < 0 ? [text.replace(/\.$/, ""), ""] : [text.slice(0, at), text.slice(at + 2)];
}

/** A change that has run: what came of it and the slots as they now are. */
function RunResult({
	run,
	plan,
	status,
}: {
	run: Run;
	plan: ActionPlan;
	status: Status;
}): ReactNode {
	const result = run.result!;
	const ok = result.exitCode === 0;
	const refused = result.exitCode === 21;
	const slots = run.after?.kind === "ok" ? run.after.status : (run.before ?? status);
	const output = [result.stdout.trim(), ok ? result.stderr.trim() : ""].filter(Boolean).join("\n");
	const [title, rest] = splitSentence(plan.done);
	const lower = `${plan.title.charAt(0).toLowerCase()}${plan.title.slice(1)}`;
	return (
		<Box flexDirection="column">
			{ok ? (
				<Heading
					glyph="check"
					tone="success"
					title={title}
					subtitle={rest || `${run.argv.join(" ")} · ${seconds(result.durationMs)}`}
				/>
			) : (
				<Heading
					glyph="bang"
					tone={refused ? "warning" : "error"}
					title={refused ? `recab refused: ${lower}` : `${plan.title} failed`}
					subtitle={`${run.argv.slice(0, 2).join(" ")} · ${exitText(result)}`}
				/>
			)}
			<StatusBlocks status={slots} />
			{ok ? null : (
				<ErrorPanel
					tone={refused ? "warning" : "danger"}
					title={refused ? "recab refused the request" : exitText(result)}
					error={recabError(result)}
				/>
			)}
			{output ? <Line intent="dimText">{truncateLines(output, 6)}</Line> : null}
		</Box>
	);
}

/** A change recab is running: that it is, and for how long. */
function Running({
	run,
	plan,
	status,
	now,
}: {
	run: Run;
	plan: ActionPlan;
	status: Status;
	now: number;
}): ReactNode {
	const writing = plan.id === "stage";
	return (
		<Box flexDirection="column">
			<Heading
				title={writing ? `Writing slot ${status.inactive_slot}` : plan.title}
				subtitle={
					writing ? `Slot ${status.active_slot} keeps running.` : "recab is making the change."
				}
			/>
			<StatusBlocks status={status} />
			<Facts
				rows={[
					["Running", run.argv.join(" ")],
					["Elapsed", elapsed(now - run.startedAt)],
				]}
			/>
		</Box>
	);
}

export function ActionPage({
	status,
	plan,
	prompt,
	run,
	now,
}: {
	status: Status | null;
	plan: ActionPlan | null;
	prompt: Prompt | null;
	/** This change's latest run. */
	run: Run | null;
	now: number;
}): ReactNode {
	if (!plan || !status)
		return (
			<Box flexDirection="column">
				<Heading
					title="No status"
					subtitle="recab status hasn't been read, so no change can be planned."
				/>
			</Box>
		);
	const heading = <Heading title={plan.title} subtitle={plan.summary} />;
	const fork =
		plan.id === "set_next" || (plan.id === "reboot" && status.trial_pending && status.next_boot) ? (
			<Fork
				target={plan.id === "set_next" ? status.inactive_slot : status.next_boot!}
				fallback={status.known_good_slot ?? status.active_slot}
			/>
		) : (
			<ChangeTable changes={plan.changes} />
		);
	const argv = plan.argv;

	if (prompt?.kind === "path")
		return (
			<Box flexDirection="column">
				{heading}
				<PathQuestions prompt={prompt} />
			</Box>
		);
	if (prompt?.kind === "confirm")
		return (
			<Box flexDirection="column">
				{heading}
				<Callout
					tone="warning"
					title={`${prompt.plan.label}?${prompt.destructive ? " Prepared changes will be lost." : ""}`}
					keys={[
						["y", "run it"],
						["n", "cancel"],
					]}
				/>
				{fork}
			</Box>
		);
	if (run && !run.result) return <Running run={run} plan={plan} status={status} now={now} />;
	if (run?.result) return <RunResult run={run} plan={plan} status={status} />;
	if (plan.verdict.kind !== "ready")
		return (
			<Box flexDirection="column">
				<Heading
					glyph="bang"
					tone={plan.verdict.kind === "refused" ? "error" : "info"}
					title={plan.title}
					subtitle={
						plan.verdict.kind === "refused" ? "recab would refuse this now." : "Nothing to change."
					}
				/>
				<StatusBlocks status={status} />
				<Line intent="info">{plan.verdict.reason}</Line>
			</Box>
		);
	return (
		<Box flexDirection="column">
			{heading}
			<Gap />
			{fork}
			<Gap />
			<Commands lines={[argv.join(" ")]} />
		</Box>
	);
}

/** Every run, newest first, down a line. */
export function HistoryPage({ runs }: { runs: readonly Run[] }): ReactNode {
	const width = useContext(ContentWidth);
	const background = useSurfaceBackground();
	const entries = runs.map((run) => {
		const result = run.result;
		const plan = run.before ? planAction(run.action, run.before) : null;
		const ok = result?.exitCode === 0;
		const title = !result
			? `${plan?.title ?? run.argv.join(" ")}, running`
			: ok
				? plan
					? splitSentence(plan.done)[0]
					: "Done"
				: `${plan?.title ?? run.argv.join(" ")} ${result.exitCode === 21 ? "refused" : "failed"}`;
		const detail = !result
			? run.argv.join(" ")
			: ok
				? run.argv.join(" ")
				: recabError(result).message;
		return {
			when: new Date(run.startedAt).toTimeString().slice(0, 8),
			mark: !result ? "◐" : ok ? "✓" : "✗",
			intent: (!result ? "warning" : ok ? "success" : "error") as ColorIntent,
			title,
			detail,
		};
	});
	const grid = new CellGrid(width, Math.max(1, entries.length * 3 - 1), background);
	entries.forEach((entry, i) => {
		const row = i * 3;
		grid.put(row, 0, entry.when, "faintText");
		grid.put(row, 10, entry.mark, entry.intent, undefined, true);
		grid.put(row, 13, truncateLine(entry.title, width - 13), "text", undefined, true);
		grid.put(row + 1, 13, truncateLine(entry.detail, width - 13), "dimText");
		if (i < entries.length - 1) {
			grid.put(row + 1, 10, "│", "contentBorder");
			grid.put(row + 2, 10, "│", "contentBorder");
		}
	});
	return (
		<Box flexDirection="column">
			<Heading
				title="This session"
				subtitle="recab keeps its own log in /var/lib/recab/audit.log."
			/>
			{runs.length === 0 ? (
				<Line intent="dimText">Nothing has run yet.</Line>
			) : (
				<CellRows grid={grid} />
			)}
		</Box>
	);
}
