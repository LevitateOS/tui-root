import { Box, Text } from "ink";
import type { ReactNode } from "react";
import {
	inkBorderStyle,
	resolveIntentColor,
	SelectableGrid,
	truncateLines,
	UiText,
	useTuiColors,
	useTuiTheme,
} from "@levitate/tui-kit";
import {
	CONFIRM_TOKEN,
	INSTALL_MODE_HELP,
	INSTALL_MODES,
	type ApplyResult,
	type InstallMode,
	type PartitionChange,
	type PartitionPlan,
} from "../generated/recpart";
import {
	canApply,
	diskPath,
	lastFailure,
	refusals,
	shownPages,
	type DiskChoice,
	type Method,
	type Run,
	type Session,
} from "../flow";
import { formatBytes, known } from "../domain/recpart";
import { DOCS, type DocsRef } from "../docs";
import {
	Callout,
	Commands,
	DiskBar,
	Facts,
	Heading,
	Section,
	StepList,
	Table,
	type BarPart,
	type StepStatus,
} from "./blocks";

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
						["Layout", `${session.mode} · ${METHOD_TITLE[session.method]}`],
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

const METHOD_TITLE: Record<Method, string> = {
	erase: "erase the disk",
	edit: "edit the partitions",
};

const METHOD_HELP: Record<Method, string> = {
	erase: "recpart's layout over the whole disk; everything on it is erased",
	edit: "keep, resize, delete and create partitions yourself (dual boot, keeping data)",
};

export function ModeSelection({
	choices,
	selected,
	defaultMode,
	width,
}: {
	choices: ReadonlyArray<{ mode: InstallMode; method: Method }>;
	selected: number;
	defaultMode: InstallMode;
	width: number;
}): ReactNode {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const dim = resolveIntentColor(theme, "dimText", colors);
	return (
		<Page
			title="Choose a layout"
			subtitle={`A layout (A/B or mutable), and whether recpart lays it over the whole disk or you edit the partitions. ${defaultMode} is the layout this system was started with.`}
		>
			<SelectableGrid
				items={choices}
				selectedIndex={selected}
				columns={INSTALL_MODES.length}
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
								{isSelected ? "● " : "○ "}
								{choice.mode} · {METHOD_TITLE[choice.method]}
							</Text>
							{choice.mode === defaultMode && choice.method === "erase" ? (
								<Text color={dim}> default</Text>
							) : null}
						</Text>
						<UiText>{INSTALL_MODE_HELP[choice.mode]}</UiText>
						<UiText intent="dimText">{METHOD_HELP[choice.method]}</UiText>
					</Box>
				)}
			/>
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
						["Layout", `${session.mode} · ${METHOD_TITLE[session.method]}`],
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

/** What the user runs after the disk is ready: this installer's guidance. */
function nextInstallSteps(target: string): string[] {
	return [`recstrap ${target}`, `recfstab ${target} >> ${target}/etc/fstab`, `recchroot ${target}`];
}

export function ResultHandoff({ apply }: { apply: Run<ApplyResult> }): ReactNode {
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
			<Section title="Next">
				<Commands lines={nextInstallSteps(handoff.install_target)} />
				<UiText intent="dimText">
					Inside recchroot, set a root password and install the bootloader.
				</UiText>
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
