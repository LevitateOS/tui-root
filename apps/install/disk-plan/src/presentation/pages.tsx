import { Box, Text } from "ink";
import type { ReactNode } from "react";
import {
	Callout,
	Commands,
	Facts,
	Heading,
	inkBorderStyle,
	resolveIntentColor,
	Section,
	SelectableGrid,
	StepList,
	type StepStatus,
	Table,
	truncateLines,
	UiText,
	useTuiColors,
	useTuiTheme,
} from "@levitate/tui-kit";
import {
	CONFIRM_TOKEN,
	INSTALL_MODES,
	type ApplyResult,
	type InspectResult,
	type InstallMode,
	type PartitionChange,
	type PartitionPlan,
} from "../generated/recpart";
import {
	canApply,
	diskPath,
	lastFailure,
	refusals,
	METHODS,
	shownPages,
	type DiskChoice,
	type Method,
	type Run,
	type Session,
} from "../flow";
import { describeSignature, formatBytes, known } from "../domain/recpart";
import { DOCS, type DocsRef } from "../docs";
import type { Saved } from "../app/install-state";
import type { Then } from "@levitate/install-state";
import { commands, STEP_INFO } from "@levitate/docs-content/install";
import { DiskBar, type BarPart } from "./disk-bar";
import { DISK_CHANGED } from "../machine";

const MB = 1024 * 1024;

function stepStatus(status: number | null, running = false): StepStatus {
	if (running) return "running";
	return status === null ? "planned" : status === 0 ? "ok" : "failed";
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

/** Where to read more, with the command that opens each page (the install screen's docs
 * pane, or install-docs on its own). */
function ReadDocs({ refs }: { refs: readonly DocsRef[] }): ReactNode {
	return (
		<Box flexDirection="column" marginTop={1}>
			<UiText bold intent="info">
				Read in the docs
			</UiText>
			{refs.map((ref) => (
				<Box key={`${ref.slug}-${ref.section ?? ""}`} flexDirection="column">
					<UiText>
						{ref.page}
						{ref.section ? ` › ${ref.section}` : ""}
					</UiText>
					<Box paddingLeft={2}>
						<UiText intent="dimText">{`install-docs --slug ${ref.slug}`}</UiText>
					</Box>
				</Box>
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

/** A page: its heading, then its parts. */
function Page({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle?: string;
	children?: ReactNode;
}): ReactNode {
	return (
		<Box flexDirection="column">
			<Heading title={title} subtitle={subtitle} />
			{children}
		</Box>
	);
}

function diskSummary(choice: DiskChoice | null): string {
	if (!choice) return "not chosen yet";
	if (choice.kind === "unlisted") return choice.path;
	const model = known(choice.disk.model);
	return `${choice.disk.path} · ${formatBytes(choice.disk.size_bytes)}${model ? ` · ${model}` : ""}`;
}

const PHASE_SUMMARY: Record<string, string> = {
	Choose: "pick the disk, the layout, and whether to erase the disk or edit its partitions",
	Review: "see the plan, the exact commands, and whether recpart would refuse the disk",
	Apply: `type ${CONFIRM_TOKEN} to erase and lay out the disk, then get the next steps`,
};

export function Welcome({ session }: { session: Session }): ReactNode {
	const pages = shownPages(session);
	const phases = [...new Set(pages.flatMap((p) => (p.phase ? [p.phase] : [])))];
	return (
		<Page
			title="Prepare a disk for LevitateOS"
			subtitle="recpart partitions, formats and mounts the disk. Every command it would run is shown before anything is written."
		>
			<Section title="How it goes">
				{phases.map((phase, i) => (
					<Box key={phase} flexDirection="column" marginBottom={i < phases.length - 1 ? 1 : 0}>
						<Text>
							<Text bold>{`${i + 1}. ${phase}`}</Text>
							<Text>
								{"   "}
								{pages
									.filter((p) => p.phase === phase)
									.map((p) => p.title)
									.join(" › ")}
							</Text>
						</Text>
						<Box paddingLeft={3}>
							<UiText intent="dimText">{PHASE_SUMMARY[phase] ?? ""}</UiText>
						</Box>
					</Box>
				))}
			</Section>
			<Section title="So far">
				<Facts
					rows={[
						["Disk", diskSummary(session.disk)],
						[
							"Layout",
							`${session.mode === "ab" ? "A/B" : "mutable"}, ${session.method === "erase" ? "erasing the whole disk" : "keeping some of it"}`,
						],
					]}
				/>
			</Section>
			<Callout tone="info" title="Nothing is written until the Confirm step">
				<UiText>
					The disk is only touched after you type {CONFIRM_TOKEN} there and press Enter.
				</UiText>
			</Callout>
		</Page>
	);
}

export function TargetDisk({
	choices,
	selected,
	columns,
	width,
	listing,
}: {
	choices: readonly DiskChoice[];
	selected: number;
	columns: number;
	width: number;
	listing: { kind: "running" } | { kind: "error"; message: string } | { kind: "done" };
}): ReactNode {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	return (
		<Page
			title="Choose a disk"
			subtitle="Next you choose whether to erase it or edit its partitions. Nothing is written before the Confirm step."
		>
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
			<SelectableGrid
				items={choices}
				selectedIndex={selected}
				columns={columns}
				width={width}
				renderItem={(choice, { selected: isSelected }) => (
					<Box
						width="100%"
						flexDirection="column"
						paddingX={1}
						borderStyle={inkBorderStyle(theme.chrome.borderGlyphSet)}
						borderColor={resolveIntentColor(theme, isSelected ? "accent" : "panelBorder", colors)}
					>
						<Text>
							<Text bold color={resolveIntentColor(theme, isSelected ? "accent" : "text", colors)}>
								{isSelected ? "▸ " : "  "}
								{diskPath(choice)}
							</Text>
							{choice.kind === "listed" ? (
								<Text bold>{`  ${formatBytes(choice.disk.size_bytes)}`}</Text>
							) : null}
						</Text>
						{choice.kind === "unlisted" ? (
							<UiText intent="warning">not listed by recpart (it will say why)</UiText>
						) : (
							<DiskFacts disk={choice.disk} />
						)}
					</Box>
				)}
			/>
		</Page>
	);
}

/** Vendor strings that only name the transport carry no information. */
const GENERIC_VENDORS = new Set(["ATA", "NVME", "SCSI"]);

function DiskFacts({ disk }: { disk: Extract<DiskChoice, { kind: "listed" }>["disk"] }): ReactNode {
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
	return (
		<>
			<UiText>{name || "(unknown model)"}</UiText>
			<UiText intent="dimText">{traits.join(" · ")}</UiText>
		</>
	);
}

/** A choice drawn as a card: a mark and title, then what it means. */
function ChoiceCard({
	selected,
	title,
	tag,
	children,
}: {
	selected: boolean;
	title: string;
	/** A dim word after the title, e.g. "default". */
	tag?: string;
	children: ReactNode;
}): ReactNode {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	return (
		<Box
			width="100%"
			flexGrow={1}
			flexDirection="column"
			paddingX={1}
			borderStyle={inkBorderStyle(theme.chrome.borderGlyphSet)}
			borderColor={resolveIntentColor(theme, selected ? "accent" : "panelBorder", colors)}
		>
			<Text>
				<Text bold color={resolveIntentColor(theme, selected ? "accent" : "text", colors)}>
					{selected ? "● " : "○ "}
					{title}
				</Text>
				{tag ? <Text color={resolveIntentColor(theme, "dimText", colors)}> {tag}</Text> : null}
			</Text>
			{children}
		</Box>
	);
}

/** Two choices side by side, or one above the other when the pane is narrow. */
function TwoChoices<T>({
	items,
	selected,
	width,
	render,
}: {
	items: readonly [T, T];
	selected: number;
	width: number;
	render: (item: T, selected: boolean) => ReactNode;
}): ReactNode {
	return (
		<Box marginBottom={1}>
			<SelectableGrid
				items={items}
				selectedIndex={selected}
				columns={width >= 60 ? 2 : 1}
				width={width}
				gapY={0}
				renderItem={(item, { selected: isSelected }) => render(item, isSelected)}
			/>
		</Box>
	);
}

const SYSTEM: Record<InstallMode, { title: string; how: string; parts: string }> = {
	ab: {
		title: "A/B: two system slots",
		how: "The system is read-only, in one of two slots. An update goes into the other slot and is tried once; if it doesn't start, the machine goes back to the working one.",
		parts: "EFI · root A · root B · state (/var)",
	},
	mutable: {
		title: "Mutable: one system",
		how: "One root you change in place, as on most distributions. Updates can't be tried first or rolled back.",
		parts: "EFI · root",
	},
};

export function SystemChoice({
	mode,
	defaultMode,
	width,
}: {
	mode: InstallMode;
	defaultMode: InstallMode;
	width: number;
}): ReactNode {
	return (
		<Page
			title="How is the system updated?"
			subtitle="This decides which partitions the system needs. You choose what happens to the disk next."
		>
			<TwoChoices
				items={INSTALL_MODES}
				selected={INSTALL_MODES.indexOf(mode)}
				width={width}
				render={(m, selected) => (
					<ChoiceCard
						selected={selected}
						title={SYSTEM[m].title}
						tag={m === defaultMode ? "default" : undefined}
					>
						<UiText>{SYSTEM[m].how}</UiText>
						<UiText intent="dimText">{`Partitions: ${SYSTEM[m].parts}`}</UiText>
					</ChoiceCard>
				)}
			/>
			<UiText intent="dimText">{`${defaultMode === "ab" ? "A/B" : "Mutable"} is what this live system was started with.`}</UiText>
		</Page>
	);
}

/** What is on the disk now, red where the choice erases it. */
function DiskContents({
	inspect,
	erasing,
}: {
	inspect: Run<InspectResult>;
	erasing: boolean;
}): ReactNode {
	if (inspect.kind === "failed")
		return (
			<UiText intent="warning">
				{`recpart couldn't read what's on the disk: ${inspect.error ? inspect.error.observed : inspect.output}`}
			</UiText>
		);
	if (inspect.kind !== "ok") return <Pending run={inspect} what="recpart inspect" />;
	const parts = inspect.value.partitions;
	const signatures = inspect.value.signatures ?? [];
	if (parts.length === 0 && signatures.length)
		return (
			<Box flexDirection="column">
				<UiText>No partition table, but the whole disk holds:</UiText>
				{signatures.map((sig) => (
					<UiText
						key={`${sig.kind}${sig.offset_bytes}`}
						bold
						intent={erasing ? "error" : "warning"}
					>
						{`• ${describeSignature(sig)}`}
					</UiText>
				))}
				<UiText intent="dimText">
					Erasing the disk destroys it; it can't be kept beside the new system.
				</UiText>
			</Box>
		);
	if (parts.length === 0)
		return <UiText intent="dimText">No partitions: the disk is empty, so nothing is lost.</UiText>;
	return (
		<Table
			tones={parts.map(() => (erasing ? "error" : null))}
			columns={[
				{ title: "Partition" },
				{ title: "Size", align: "right" },
				{ title: "FS" },
				{ title: "Label", optional: true },
				{ title: "In use", optional: true },
			]}
			rows={parts.map((part) => [
				part.device.replace(/^\/dev\//, ""),
				formatBytes(part.size_bytes),
				part.filesystem ?? "",
				part.fs_label ?? part.label ?? "",
				part.used_bytes !== null ? formatBytes(part.used_bytes) : "",
			])}
		/>
	);
}

export function DiskUse({
	method,
	mode,
	path,
	inspect,
	width,
}: {
	method: Method;
	mode: InstallMode;
	path: string | null;
	inspect: Run<InspectResult>;
	width: number;
}): ReactNode {
	const parts = inspect.kind === "ok" ? inspect.value.partitions : null;
	const signatures = inspect.kind === "ok" ? (inspect.value.signatures ?? []) : [];
	const lost =
		parts === null
			? "Everything on it is erased."
			: parts.length === 0 && signatures.length
				? `Erases ${signatures.map(describeSignature).join(" and ")} on it.`
				: parts.length === 0
					? "The disk is empty, so nothing is lost."
					: `Erases all ${parts.length} partition${parts.length === 1 ? "" : "s"} below.`;
	return (
		<Page
			title="What happens to the disk?"
			subtitle={`${path ?? "The disk"}: give it all to the new system, or keep some of what is on it. Nothing is written until the Confirm step.`}
		>
			<TwoChoices
				items={METHODS as readonly [Method, Method]}
				selected={METHODS.indexOf(method)}
				width={width}
				render={(m, selected) =>
					m === "erase" ? (
						<ChoiceCard selected={selected} title="Erase the whole disk" tag="simplest">
							<UiText>{`The ${mode === "ab" ? "A/B" : "mutable"} partitions take all of it.`}</UiText>
							<UiText intent={parts?.length || signatures.length ? "error" : "dimText"}>
								{lost}
							</UiText>
						</ChoiceCard>
					) : (
						<ChoiceCard selected={selected} title="Keep some of it">
							<UiText>
								Keep, shrink or delete partitions and place the new ones: for dual boot, or keeping
								data.
							</UiText>
							<UiText intent="dimText">
								{parts?.length === 0
									? "There's nothing on this disk to keep."
									: "Next: the partition editor."}
							</UiText>
						</ChoiceCard>
					)
				}
			/>
			<Section
				title={`On ${path ?? "the disk"} now`}
				trailing={
					inspect.kind === "ok"
						? `${formatBytes(inspect.value.disk.size_bytes)} · ${inspect.value.table === "none" ? "no partition table" : `${inspect.value.table} table`}`
						: undefined
				}
			>
				<DiskContents inspect={inspect} erasing={method === "erase"} />
			</Section>
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
				entry.device,
				entry.change,
				state(entry.before),
				state(entry.after),
				entry.role === "other" ? (entry.mountpoint ?? "") : (entry.role ?? entry.mountpoint ?? ""),
			])}
		/>
	);
}

/** The disk after the plan, in disk order: every partition on it (its role, or its device)
 * and the free space between them. */
function barParts(plan: PartitionPlan): BarPart[] {
	const placed = plan.summary
		.flatMap((entry) => (entry.after ? [{ entry, after: entry.after }] : []))
		.sort((a, b) => a.after.start_bytes - b.after.start_bytes);
	const parts: BarPart[] = [];
	const minimum = plan.disk.size_bytes / 100;
	const free = (size: number) => {
		if (size > minimum) parts.push({ label: "free", detail: formatBytes(size), size });
	};
	let cursor = 0;
	for (const { entry, after } of placed) {
		free(after.start_bytes - cursor);
		parts.push({
			label:
				entry.role === "other"
					? (entry.mountpoint ?? entry.device)
					: (entry.role ?? entry.device.replace(/^\/dev\//, "")),
			detail: formatBytes(after.size_bytes),
			size: after.size_bytes,
		});
		cursor = after.start_bytes + after.size_bytes;
	}
	free(plan.disk.size_bytes - cursor);
	return parts;
}

export function PlanPreview({ plan }: { plan: Run<PartitionPlan> }): ReactNode {
	const title = "Partition plan";
	const subtitle = "What recpart would do to the disk. Nothing has been written yet.";
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
	const size = (mb: number | null) => (mb === null ? "rest of disk" : formatBytes(mb * MB));
	return (
		<Page title={title} subtitle={subtitle}>
			<Section title="Changes" trailing={value.wipes_disk ? "the whole disk is erased" : undefined}>
				<ChangeTable summary={value.summary} />
			</Section>
			<Section
				title={value.disk.path}
				trailing={`${formatBytes(value.disk.size_bytes)} · layout ${value.mode}`}
			>
				<DiskBar total={value.disk.size_bytes} parts={barParts(value)} />
			</Section>
			<Section title="Partitions">
				<Table
					columns={[
						{ title: "#", align: "right" },
						{ title: "Name" },
						{ title: "Label", optional: true },
						{ title: "Type" },
						{ title: "Mount" },
						{ title: "Size", align: "right" },
					]}
					rows={value.partitions.map((p) => [
						String(p.index),
						p.name,
						p.label,
						p.filesystem,
						p.mountpoint,
						size(p.size_mb),
					])}
				/>
			</Section>
			<Section title="sfdisk script">
				<UiText intent="dimText">{value.sfdisk_script.trimEnd()}</UiText>
			</Section>
		</Page>
	);
}

/** Every command this session ran or would run, from the runs themselves. */
export function CommandPreview({
	log,
	dryRun,
}: {
	log: readonly Run<unknown>[];
	dryRun: Run<ApplyResult>;
}): ReactNode {
	const title = "Review the commands";
	const subtitle =
		"Exactly what the apply will run, from recpart's dry run. Nothing has been written yet.";
	if (dryRun.kind === "failed")
		return (
			<Page title={title} subtitle={subtitle}>
				<Failed title="recpart's dry run failed" run={dryRun} />
			</Page>
		);
	const ran = log.flatMap((run) => (run.kind === "idle" ? [] : [run]));
	return (
		<Page title={title} subtitle={subtitle}>
			<Section
				title="What apply will run"
				trailing={dryRun.kind === "ok" ? `${dryRun.value.steps.length} steps` : undefined}
			>
				{dryRun.kind === "ok" ? (
					<StepList
						steps={dryRun.value.steps.map((step) => ({
							phase: step.phase,
							command: step.command,
							status: "planned",
						}))}
					/>
				) : (
					<Pending run={dryRun} what="The dry run" />
				)}
			</Section>
			<Section title="Run so far" trailing={`${ran.length}`}>
				<StepList
					steps={ran.map((run) => ({
						phase: "",
						command: run.argv.join(" "),
						status: run.kind === "running" ? "running" : run.kind === "ok" ? "ok" : "failed",
					}))}
				/>
			</Section>
		</Page>
	);
}

export function PreflightChecks({ session }: { session: Session }): ReactNode {
	const title = "Safety checks";
	const subtitle = "Whether recpart's dry run found a reason to refuse this disk.";
	if (session.dryRun.kind !== "ok")
		return (
			<Page title={title} subtitle={subtitle}>
				<Pending run={session.dryRun} what="The dry run" />
			</Page>
		);
	const refused = refusals(session);
	return (
		<Page title={title} subtitle={subtitle}>
			{refused.length === 0 ? (
				<Callout tone="success" title="recpart would apply to this disk">
					<UiText intent="dimText">From {session.dryRun.argv.join(" ")}</UiText>
				</Callout>
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
	const unlocked = canApply(session);
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const dim = resolveIntentColor(theme, "dimText", colors);
	const rest = CONFIRM_TOKEN.length - session.token.length;
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
	const title =
		!plan || plan.wipes_disk
			? `This erases everything on ${path}`
			: lost.length
				? `This erases ${partitions(lost.length)} on ${path}${other ? ` and ${other}` : ""}`
				: `Nothing on ${path} is erased: this ${other || "changes no partition"}`;
	return (
		<Page title="Write to the disk?" subtitle="The last step before recpart writes to the disk.">
			<Callout tone="danger" title={title}>
				<Facts
					rows={[
						...(listed
							? ([
									["Size", formatBytes(listed.size_bytes)],
									["Model", known(listed.model) ?? "(unknown)"],
									["Serial", known(listed.serial) ?? "(unknown)"],
								] as [string, string][])
							: []),
						[
							"Layout",
							`${session.mode === "ab" ? "A/B" : "mutable"}, ${session.method === "erase" ? "erasing the whole disk" : "keeping some of it"}`,
						],
						...(plan?.erased_signatures?.length
							? ([["Also erased", plan.erased_signatures.map(describeSignature).join(", ")]] as [
									string,
									string,
								][])
							: []),
					]}
				/>
			</Callout>
			{plan ? (
				<Section title="What happens to each partition">
					<ChangeTable summary={plan.summary} />
				</Section>
			) : null}
			<Section title={`Type ${CONFIRM_TOKEN} to unlock`}>
				<Text>
					<Text color={dim}>› </Text>
					<Text bold color={resolveIntentColor(theme, unlocked ? "success" : "error", colors)}>
						{session.token}
					</Text>
					<Text color={dim}>{"_".repeat(Math.max(0, rest))}</Text>
				</Text>
				{unlocked ? (
					<UiText bold intent="success">
						Unlocked. Enter starts the apply.
					</UiText>
				) : (
					<UiText intent="dimText">Locked: Backspace corrects a typo.</UiText>
				)}
			</Section>
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
			<Page title="The apply failed" subtitle="recpart stopped; the Failure view has the details.">
				<Failed title="Apply failed" run={apply} />
			</Page>
		);
	if (apply.kind === "ok") {
		const steps = apply.value.steps;
		return (
			<Page title="Applied" subtitle="recpart laid out the disk.">
				<Callout tone="success" title="Apply completed">
					<UiText intent="dimText">Next: Done, with what to run next.</UiText>
				</Callout>
				<Section
					title="Steps"
					trailing={`${steps.filter((step) => step.status === 0).length}/${steps.length}`}
				>
					<StepList
						steps={steps.map((step) => ({
							phase: step.phase,
							command: step.command,
							status: stepStatus(step.status),
						}))}
					/>
				</Section>
			</Page>
		);
	}
	return (
		<Page title="Applying the plan" subtitle="recpart is writing to the disk. Don't power off.">
			<Pending run={apply} what="The apply" />
			{dryRun.kind === "ok" ? (
				<Section title="Steps">
					<StepList
						steps={dryRun.value.steps.map((step) => ({
							phase: step.phase,
							command: step.command,
							status: stepStatus(null, apply.kind === "running"),
						}))}
					/>
				</Section>
			) : null}
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
	const handoff = apply.value.handoff;
	const slot = handoff.mode_context.install_target_slot;
	return (
		<Page title="Disk ready" subtitle="The disk is laid out and mounted, ready for the system.">
			<Callout tone="success" title={`Ready at ${handoff.install_target}`}>
				{slot ? (
					<UiText intent="dimText">
						Installing into slot {slot}; slot {handoff.mode_context.inactive_slot_hint} stays
						unmounted for updates.
					</UiText>
				) : null}
			</Callout>
			<Section title="Mounted">
				<Table
					columns={[{ title: "Path" }, { title: "Device" }]}
					rows={handoff.mount_map.map((entry) => [entry.path, entry.device])}
				/>
			</Section>
			{saved?.kind === "ok" ? (
				<UiText intent="dimText">Saved for the next install steps in {saved.path}.</UiText>
			) : saved?.kind === "failed" ? (
				<Callout tone="warning" title={`Couldn't save the result to ${saved.path}`}>
					<UiText intent="dimText">
						{saved.message}. The next steps will ask for the target and the slots again.
					</UiText>
				</Callout>
			) : null}
			<Section title={`Next: ${STEP_INFO.base.title}`}>
				<UiText intent="dimText">{STEP_INFO.base.about}</UiText>
				{then === "hub" ? (
					<UiText intent="dimText">q goes back to the install steps, which start it.</UiText>
				) : (
					<Commands lines={[commands.baseSystem()]} />
				)}
			</Section>
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
			<Page title={title} subtitle={subtitle}>
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
		<Page title={title} subtitle={subtitle}>
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
