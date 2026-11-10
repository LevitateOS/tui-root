import { Box } from "ink";
import { createContext, useContext, type ReactNode } from "react";
import {
	Callout,
	Commands,
	DiskBar,
	Facts,
	formatBytes,
	Heading,
	ProgressBar,
	RunSheet,
	Section,
	shortDevice,
	Table,
	truncateLines,
	UiText,
	WordSlots,
	type ColorIntent,
	type DiskPart,
	type PathState,
} from "@levitate/tui-kit";
import {
	CONFIRM_TOKEN,
	type ApplyResult,
	type InspectResult,
	type InstallMode,
	type PartitionChange,
	type PartitionPlan,
} from "../generated/recpart";
import {
	diskPath,
	lastFailure,
	refusals,
	shownPages,
	type DiskChoice,
	type Method,
	type Run,
	type Session,
} from "../flow";
import { describeSignature, known } from "../domain/recpart";
import { DOCS, type DocsRef } from "../docs";
import type { Saved } from "../app/install-state";
import type { Then } from "@levitate/install-state";
import { commands, MODE_NAME } from "@levitate/docs-content/install";
import { DISK_CHANGED } from "../machine";
import {
	afterBar,
	afterParts,
	BarLabels,
	BlankRow,
	ChoiceTitle,
	DiskLines,
	inspectedParts,
	nowParts,
	Runs,
	SlotCards,
	WritingLine,
	type DiskLine,
	type SlotCard,
	type Stage,
} from "./pictures";

/** The number of the step being shown, for the big figure in its heading; none on the
 * overview and the failure view. */
export const StepNumber = createContext<number | undefined>(undefined);

/** A page: its heading, then its parts. A `glyph` replaces the step number (a tick, a
 * warning). */
function Page({
	title,
	subtitle,
	glyph,
	tone,
	children,
}: {
	title: string;
	subtitle?: ReactNode;
	glyph?: "check" | "bang";
	tone?: ColorIntent;
	children?: ReactNode;
}): ReactNode {
	const step = useContext(StepNumber);
	return (
		<Box flexDirection="column">
			<Heading
				title={title}
				subtitle={subtitle}
				glyph={glyph}
				step={glyph ? undefined : step}
				tone={tone}
			/>
			{children}
		</Box>
	);
}

function Pending({ run, what }: { run: Run<unknown>; what: string }): ReactNode {
	return (
		<UiText intent="dimText">
			{run.kind === "running" ? `Running ${run.argv.join(" ")} …` : `${what} hasn't run yet.`}
		</UiText>
	);
}

/** One refusal from the dry run, split into what recpart found, what to do and its code
 * (recpart writes `E001: [component] expected …, observed …. remediation: …`). */
function Refusal({ text }: { text: string }): ReactNode {
	const parts = /^(E\d+): \[[^\]]*\] expected (.*), observed (.*)\. remediation: (.*)$/s.exec(text);
	if (!parts) return <UiText>✗ {text}</UiText>;
	const [, code, expected, observed, remediation] = parts;
	return (
		<Box flexDirection="column" marginBottom={1}>
			<UiText bold>✗ {observed}</UiText>
			<Box paddingLeft={2}>
				<UiText intent="warning">{`${remediation}`}</UiText>
			</Box>
			<Box paddingLeft={2}>
				<UiText intent="dimText">{`${code} · expected ${expected}`}</UiText>
			</Box>
		</Box>
	);
}

/** Where to read more: the page and section of the docs (the install screen's docs pane). */
function ReadDocs({ refs }: { refs: readonly DocsRef[] }): ReactNode {
	return (
		<Box flexDirection="column" marginTop={1}>
			<UiText bold intent="info">
				Read in the docs
			</UiText>
			{refs.map((ref) => (
				<UiText key={`${ref.slug}-${ref.section ?? ""}`}>
					{ref.page}
					{ref.section ? ` › ${ref.section}` : ""}
				</UiText>
			))}
		</Box>
	);
}

/** A recpart run that failed: what ran, what it saw, and what to do about it. */
function Failed({
	title,
	run,
}: {
	title: string;
	run: Extract<Run<unknown>, { kind: "failed" }>;
}): ReactNode {
	return (
		<Callout tone="danger" title={title}>
			<UiText intent="dimText">
				{run.argv.join(" ")} ({run.exitCode === null ? "did not run" : `exit ${run.exitCode}`})
			</UiText>
			<UiText>{truncateLines(run.error ? run.error.observed : run.output, 12)}</UiText>
			{run.error ? <UiText intent="warning">{run.error.remediation}</UiText> : null}
			<ReadDocs refs={[DOCS.recpartErrors]} />
		</Callout>
	);
}

/** What each stage of the flow is, in a few words. */
const STAGE_TEXT: Record<string, string> = {
	Choose: "the disk and the layout",
	Review: "the plan and its commands",
	Apply: "it is written",
};

export function Welcome({ session }: { session: Session }): ReactNode {
	const phases = [...new Set(shownPages(session).flatMap((p) => (p.phase ? [p.phase] : [])))];
	const stages: Stage[] = phases.map((phase) => ({
		title: phase,
		text: STAGE_TEXT[phase] ?? "",
	}));
	return (
		<Page
			title="Prepare the install disk"
			subtitle="Every command is shown before anything is written."
		>
			<BlankRow />
			<WritingLine stages={stages} note={`Nothing is written before you type ${CONFIRM_TOKEN}.`} />
		</Page>
	);
}

/** Vendor strings that only name the transport carry no information. */
const GENERIC_VENDORS = new Set(["ATA", "NVME", "SCSI"]);

/** One line about a disk: what it is called, then what kind it is. */
function diskDetail(disk: Extract<DiskChoice, { kind: "listed" }>["disk"]): string {
	const vendor = known(disk.vendor);
	const name = [
		vendor && !GENERIC_VENDORS.has(vendor.toUpperCase()) ? vendor : null,
		known(disk.model),
	]
		.filter(Boolean)
		.join(" ");
	const traits = [
		disk.rotational ? "HDD" : "SSD",
		known(disk.transport),
		disk.removable ? "removable" : null,
		disk.read_only ? "read-only" : null,
		known(disk.serial) ? `serial ${known(disk.serial)}` : null,
	].filter(Boolean);
	return [name || "(unknown model)", traits.join(", ")].filter(Boolean).join(", ");
}

/** The rows of disk blocks that fit in `rows`, around the selected one. */
function diskWindow(count: number, selected: number, rows: number): [number, number] {
	const fit = Math.max(1, Math.floor((rows + 1) / 4));
	const first = Math.min(Math.max(0, selected - Math.floor(fit / 2)), Math.max(0, count - fit));
	return [first, Math.min(count, first + fit)];
}

export function TargetDisk({
	choices,
	selected,
	rows,
	listing,
}: {
	choices: readonly DiskChoice[];
	selected: number;
	/** The rows the page may use under its heading. */
	rows: number;
	listing: { kind: "running" } | { kind: "error"; message: string } | { kind: "done" };
}): ReactNode {
	const lines: DiskLine[] = choices.map((choice) =>
		choice.kind === "unlisted"
			? {
					path: choice.path,
					size: null,
					detail: "not listed by recpart (it will say why)",
					warn: true,
				}
			: {
					path: choice.disk.path,
					size: choice.disk.size_bytes,
					detail: diskDetail(choice.disk),
					warn: false,
				},
	);
	const [first, last] = diskWindow(lines.length, selected, rows);
	return (
		<Page title="Which disk?" subtitle="Nothing is written before the Confirm step.">
			{listing.kind === "running" ? (
				<UiText intent="dimText">Running recpart list-disks --json …</UiText>
			) : null}
			{listing.kind === "error" ? (
				<Callout tone="danger" title="recpart couldn't list the disks">
					<UiText>{listing.message}</UiText>
					<ReadDocs refs={[DOCS.recpartErrors]} />
				</Callout>
			) : null}
			{listing.kind === "done" && choices.length === 0 ? (
				<Callout tone="warning" title="recpart listed no disks" />
			) : null}
			{lines.length > 0 ? (
				<DiskLines disks={lines.slice(first, last)} selected={selected - first} />
			) : null}
		</Page>
	);
}

const SYSTEM: Record<InstallMode, SlotCard> = {
	ab: {
		title: "A/B",
		slots: [
			{ label: "A", state: "running", running: true },
			{ label: "B", state: "spare", running: false },
		],
		text: "An update goes into the other slot and is tried once. If it does not start, it is never kept.",
	},
	mutable: {
		title: "Mutable",
		slots: [{ label: "root", state: "running", running: true }],
		text: "One root you change in place. An update cannot be undone.",
	},
};

export function SystemChoice({
	modes,
	mode,
	defaultMode,
}: {
	modes: readonly [InstallMode, InstallMode];
	mode: InstallMode;
	defaultMode: InstallMode;
}): ReactNode {
	return (
		<Page
			title="How is the system updated?"
			subtitle="This decides which partitions the system needs."
		>
			<SlotCards
				selected={modes.indexOf(mode)}
				cards={modes.map((m) => ({
					...SYSTEM[m],
					tag: m === defaultMode ? "default" : undefined,
				}))}
			/>
		</Page>
	);
}

/** What erasing the disk would lose, in a few words. */
function lostText(inspect: Run<InspectResult>): { text: string; loses: boolean } {
	if (inspect.kind === "failed")
		return {
			text: `recpart couldn't read the disk: ${inspect.error ? inspect.error.observed : inspect.output}`,
			loses: false,
		};
	if (inspect.kind !== "ok") return { text: "Everything on it is erased.", loses: true };
	const parts = inspect.value.partitions;
	const signatures = inspect.value.signatures ?? [];
	if (parts.length === 0 && signatures.length)
		return { text: `Erases ${signatures.map(describeSignature).join(" and ")}.`, loses: true };
	if (parts.length === 0) return { text: "The disk is empty, so nothing is lost.", loses: false };
	return {
		text: `Erases all ${parts.length} partition${parts.length === 1 ? "" : "s"}.`,
		loses: true,
	};
}

export function DiskUse({
	method,
	mode,
	inspect,
	erasePlan,
	methods,
}: {
	method: Method;
	mode: InstallMode;
	inspect: Run<InspectResult>;
	/** The mode's template planned over the whole disk: what erasing leaves. */
	erasePlan: Run<PartitionPlan>;
	methods: readonly [Method, Method];
}): ReactNode {
	const parts = inspect.kind === "ok" ? inspect.value.partitions : null;
	const signatures = inspect.kind === "ok" ? (inspect.value.signatures ?? []) : [];
	const lost = lostText(inspect);
	const now: DiskPart[] | null = inspect.kind === "ok" ? inspectedParts(inspect.value) : null;
	const keep: DiskPart[] | null =
		inspect.kind === "ok" ? inspectedParts(inspect.value, true) : null;
	const erased =
		erasePlan.kind === "ok"
			? afterParts(erasePlan.value.summary, erasePlan.value.disk.size_bytes)
			: null;
	const total = inspect.kind === "ok" ? inspect.value.disk.size_bytes : undefined;
	const bar = (picture: DiskPart[] | null) =>
		picture ? <DiskBar parts={picture} total={total} /> : <BlankRow />;
	return (
		<Page
			title="What happens to the disk?"
			subtitle="Keep what is on it, or give it all to the new system."
		>
			{now ? <DiskBar parts={now} total={total} label="Now" /> : <BlankRow />}
			{parts?.length === 0 && signatures.length ? (
				<Runs
					runs={[
						["No partition table, but the whole disk holds: ", "dimText"],
						[
							signatures.map(describeSignature).join(", "),
							method === "erase" ? "error" : "warning",
						],
					]}
				/>
			) : (
				<BlankRow />
			)}
			<BlankRow />
			{methods.map((m) =>
				m === "edit" ? (
					<Box key={m} flexDirection="column">
						<ChoiceTitle
							chosen={method === m}
							title="Keep some of it"
							cost={
								parts?.length === 0 && !signatures.length
									? "There is nothing on this disk to keep."
									: "You choose what stays in the next step."
							}
							tone="success"
						/>
						{bar(keep)}
						<UiText intent="dimText">
							{"Keep, shrink or delete partitions, then place the new ones."}
						</UiText>
						<BlankRow />
					</Box>
				) : (
					<Box key={m} flexDirection="column">
						<ChoiceTitle
							chosen={method === m}
							title="Erase the whole disk"
							cost={lost.text}
							tone={lost.loses ? "error" : "dimText"}
						/>
						{bar(erased)}
						{erasePlan.kind === "failed" ? (
							<UiText intent="warning">
								{`recpart can't plan this disk: ${erasePlan.error ? erasePlan.error.observed : erasePlan.output}`}
							</UiText>
						) : (
							<UiText intent="dimText">{`The ${MODE_NAME[mode]} partitions take all of it.`}</UiText>
						)}
						<BlankRow />
					</Box>
				),
			)}
		</Page>
	);
}

const CHANGE_TONE: Record<PartitionChange["change"], "error" | "warning" | "success" | null> = {
	erased: "error",
	formatted: "error",
	resized: "warning",
	created: "success",
	untouched: null,
};

/** recpart's per-partition summary: what each partition was and becomes. */
function ChangeTable({ summary }: { summary: readonly PartitionChange[] }): ReactNode {
	const state = (s: PartitionChange["before"]) =>
		s ? `${formatBytes(s.size_bytes)}${s.filesystem ? ` ${s.filesystem}` : ""}` : "";
	const use = (entry: PartitionChange) =>
		entry.role === "other"
			? (entry.mountpoint ?? "")
			: [entry.role, entry.mountpoint].filter(Boolean).join("  ");
	return (
		<Table
			tones={summary.map((entry) => CHANGE_TONE[entry.change])}
			columns={[
				{ title: "Partition" },
				{ title: "Change" },
				{ title: "Before" },
				{ title: "After" },
				{ title: "Use" },
			]}
			rows={summary.map((entry) => [
				shortDevice(entry.device),
				entry.change,
				state(entry.before),
				state(entry.after),
				use(entry),
			])}
		/>
	);
}

/** The disk now over the disk after, as two bars. */
function NowAfter({ plan }: { plan: PartitionPlan }): ReactNode {
	const total = plan.disk.size_bytes;
	return (
		<>
			<DiskBar parts={nowParts(plan)} total={total} label="Now" />
			<DiskBar parts={afterParts(plan.summary, total)} total={total} label="After" />
		</>
	);
}

export function PlanPreview({ plan }: { plan: Run<PartitionPlan> }): ReactNode {
	const title = "The plan";
	const subtitle = "What recpart would do. Nothing has been written yet.";
	if (plan.kind === "failed")
		return (
			<Page title={title} subtitle={subtitle}>
				<Failed title="recpart couldn't plan this disk" run={plan} />
			</Page>
		);
	if (plan.kind !== "ok")
		return (
			<Page title={title} subtitle={subtitle}>
				<Pending run={plan} what="The plan" />
			</Page>
		);
	const value = plan.value;
	const changed = value.summary.filter((entry) => entry.change !== "untouched");
	const left = value.summary.length - changed.length;
	return (
		<Page title={title} subtitle={subtitle}>
			<NowAfter plan={value} />
			<BlankRow />
			<ChangeTable summary={changed} />
			<BlankRow />
			{value.wipes_disk ? (
				<UiText intent="error">The whole disk is erased.</UiText>
			) : left > 0 ? (
				<UiText intent="info">{`${left === 1 ? "One other partition is" : `${left} other partitions are`} left as ${left === 1 ? "it is" : "they are"}.`}</UiText>
			) : null}
			<BlankRow />
			<Section title="sfdisk script">
				<UiText intent="dimText">{value.sfdisk_script.trimEnd()}</UiText>
			</Section>
		</Page>
	);
}

/** A command's phase as the run sheet names it. */
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The commands of a dry run or an apply, as the run sheet's rows. */
function sheetSteps(steps: ApplyResult["steps"], state: (status: number | null) => PathState) {
	return steps.map((step) => ({
		phase: capital(step.phase),
		command: step.command,
		state: state(step.status),
	}));
}

/** Every command the apply will run, from the dry run. */
export function CommandPreview({ dryRun }: { dryRun: Run<ApplyResult> }): ReactNode {
	const title = "The commands";
	const subtitle = "Exactly what the apply will run, in this order.";
	if (dryRun.kind === "failed")
		return (
			<Page title={title} subtitle={subtitle}>
				<Failed title="recpart's dry run failed" run={dryRun} />
			</Page>
		);
	return (
		<Page title={title} subtitle={subtitle}>
			{dryRun.kind === "ok" ? (
				<RunSheet steps={sheetSteps(dryRun.value.steps, () => "waiting")} />
			) : (
				<Pending run={dryRun} what="The dry run" />
			)}
		</Page>
	);
}

export function PreflightChecks({ session }: { session: Session }): ReactNode {
	const title = "The rehearsal";
	const subtitle = "recpart checked the plan, without writing anything.";
	if (session.dryRun.kind !== "ok")
		return (
			<Page title={title} subtitle={subtitle}>
				<Pending run={session.dryRun} what="The dry run" />
			</Page>
		);
	const refused = refusals(session);
	const dry = session.dryRun.value;
	return (
		<Page title={title} subtitle={subtitle}>
			{refused.length === 0 ? (
				<Callout
					tone="success"
					title="recpart would apply to this disk"
					facts={[
						["Commands", `${dry.steps.length} listed, none run`],
						[
							"Disk checks",
							dry.disk_checks_skipped
								? "skipped: planned from a recorded inventory"
								: "made on the disk",
						],
					]}
				/>
			) : (
				<Callout tone="danger" title="recpart would refuse this disk">
					{refused.map((reason) => (
						<Refusal key={reason} text={reason} />
					))}
					<UiText intent="dimText">
						Fix these, then go back to Commands to run the dry run again.
					</UiText>
					<ReadDocs refs={[DOCS.chooseDisk, DOCS.recpart]} />
				</Callout>
			)}
		</Page>
	);
}

export function DestructiveConfirm({ session }: { session: Session }): ReactNode {
	const disk = session.disk;
	const listed = disk?.kind === "listed" ? disk.disk : null;
	const plan = session.plan.kind === "ok" ? session.plan.value : null;
	const lost = plan?.summary.filter((e) => e.change === "erased" || e.change === "formatted") ?? [];
	const path = disk ? diskPath(disk) : "(no disk)";
	const count = (change: PartitionChange["change"]) =>
		plan?.summary.filter((e) => e.change === change).length ?? 0;
	const partitions = (n: number) => `${n} partition${n === 1 ? "" : "s"}`;
	const other = [
		count("resized") ? `resizes ${partitions(count("resized"))}` : null,
		count("created") ? `creates ${partitions(count("created"))}` : null,
	]
		.filter(Boolean)
		.join(" and ");
	const cost =
		!plan || plan.wipes_disk
			? `This erases everything on ${path}.`
			: lost.length
				? `This erases ${partitions(lost.length)} on ${path}${other ? ` and ${other}` : ""}.`
				: `Nothing on ${path} is erased: this ${other || "changes no partition"}.`;
	return (
		<Page
			title="Write to the disk?"
			subtitle="Everything before this was a rehearsal."
			tone="error"
		>
			{plan ? <NowAfter plan={plan} /> : null}
			<BlankRow />
			<UiText bold>{cost}</UiText>
			<BlankRow />
			<Facts
				rows={[
					...(listed
						? ([
								[
									"Disk",
									[formatBytes(listed.size_bytes), known(listed.model), known(listed.serial)]
										.filter(Boolean)
										.join(", "),
								],
							] as [string, string][])
						: []),
					[
						"Layout",
						`${MODE_NAME[session.mode]}, ${session.method === "erase" ? "erasing the whole disk" : "keeping some of it"}`,
					],
					...(plan?.erased_signatures?.length
						? ([["Also erased", plan.erased_signatures.map(describeSignature).join(", ")]] as [
								string,
								string,
							][])
						: []),
				]}
			/>
			<BlankRow />
			<WordSlots word={CONFIRM_TOKEN} typed={session.token} />
		</Page>
	);
}

export function ApplyProgress({
	apply,
	dryRun,
}: {
	apply: Run<ApplyResult>;
	dryRun: Run<ApplyResult>;
}): ReactNode {
	if (apply.kind === "failed")
		return (
			<Page
				title="The apply stopped"
				subtitle="recpart stopped; the failure view has the details."
				glyph="bang"
				tone="error"
			>
				<Failed title="Apply failed" run={apply} />
			</Page>
		);
	if (apply.kind === "ok") {
		const steps = apply.value.steps;
		return (
			<Page
				title="Apply completed"
				subtitle={`${steps.length} commands ran. The disk is laid out.`}
				glyph="check"
				tone="success"
			>
				<RunSheet steps={sheetSteps(steps, (status) => (status === 0 ? "done" : "failed"))} />
			</Page>
		);
	}
	return (
		<Page title="Writing the disk" subtitle="Do not turn the machine off.">
			<ProgressBar fraction={null} />
			<BlankRow />
			{dryRun.kind === "ok" ? (
				<RunSheet steps={sheetSteps(dryRun.value.steps, () => "waiting")} />
			) : (
				<Pending run={apply} what="The apply" />
			)}
		</Page>
	);
}

export function ResultHandoff({
	apply,
	saved,
	then,
}: {
	apply: Run<ApplyResult>;
	saved: Saved | null;
	then: Then;
}): ReactNode {
	if (apply.kind !== "ok")
		return (
			<Page title="Disk ready">
				<UiText intent="dimText">The apply hasn't succeeded.</UiText>
			</Page>
		);
	const { handoff, summary, disk } = apply.value;
	const slot = handoff.mode_context.install_target_slot;
	const mounted = (entry: PartitionChange) =>
		handoff.mount_map.find((mount) => mount.device === entry.device)?.path ?? "";
	const bar = afterBar(summary, disk.size_bytes, mounted);
	return (
		<Page
			title="The disk is ready"
			subtitle={`Laid out and mounted at ${handoff.install_target}.`}
			glyph="check"
			tone="success"
		>
			<DiskBar parts={bar.parts} total={disk.size_bytes} />
			<BarLabels parts={bar.parts} labels={bar.labels} total={disk.size_bytes} />
			<BlankRow />
			{slot ? (
				<UiText intent="dimText">
					{`Installing into slot ${slot}; slot ${handoff.mode_context.inactive_slot_hint} stays unmounted for updates.`}
				</UiText>
			) : null}
			{saved?.kind === "ok" ? (
				<UiText intent="dimText">Saved for the next install steps in {saved.path}.</UiText>
			) : saved?.kind === "failed" ? (
				<Callout tone="warning" title={`Couldn't save the result to ${saved.path}`}>
					<UiText intent="dimText">
						{saved.message}. The next steps will ask for the target and the slots again.
					</UiText>
				</Callout>
			) : null}
			{then === "hub" ? null : (
				<>
					<BlankRow />
					<Commands lines={[commands.baseSystem()]} />
				</>
			)}
		</Page>
	);
}

export function FailureDiagnostics({ session }: { session: Session }): ReactNode {
	const failure = lastFailure(session);
	const title = "What went wrong";
	const subtitle = "As recpart reported it.";
	if (!failure)
		return (
			<Page title={title} subtitle={subtitle}>
				<UiText intent="dimText">Nothing has failed.</UiText>
			</Page>
		);
	if (failure.step === "preflight") {
		return (
			<Page title={title} subtitle={subtitle} glyph="bang" tone="error">
				<Callout tone="danger" title="Safety checks: recpart would refuse this disk">
					{failure.refusals.map((reason) => (
						<Refusal key={reason} text={reason} />
					))}
					<ReadDocs refs={[DOCS.chooseDisk, DOCS.recpart]} />
				</Callout>
			</Page>
		);
	}
	const { run } = failure;
	return (
		<Page title={title} subtitle={subtitle} glyph="bang" tone="error">
			{run.error?.code === DISK_CHANGED ? (
				<Callout tone="info" title="Nothing was written: the disk changed since you reviewed it">
					<UiText>
						recpart checks that the disk still gives the plan you confirmed before it writes
						anything. Press R to read the disks again, then check the disk and the plan.
					</UiText>
				</Callout>
			) : null}
			<Failed title={`Failure in ${failure.step}`} run={run} />
			{run.error ? (
				<Section title="Details">
					<Facts
						rows={[
							["Code", run.error.code],
							["Component", run.error.component],
							["Expectation", run.error.expectation],
						]}
					/>
				</Section>
			) : null}
		</Page>
	);
}
