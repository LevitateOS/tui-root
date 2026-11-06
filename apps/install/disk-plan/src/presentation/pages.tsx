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
	type PartitionPlan,
} from "../generated/recpart";
import {
	canApply,
	diskPath,
	lastFailure,
	PAGES,
	refusals,
	type DiskChoice,
	type Run,
	type Session,
} from "../flow";
import { formatBytes, known } from "../domain/recpart";

const Blank = () => <UiText> </UiText>;

/** One step line, the same everywhere: `[PLANNED|OK|FAIL] phase :: command`. */
function stepLine(phase: string, command: string, status: number | null): string {
	return `[${status === null ? "PLANNED" : status === 0 ? "OK" : "FAIL"}] ${phase} :: ${command}`;
}

function Pending({ run, what }: { run: Run<unknown>; what: string }): ReactNode {
	return (
		<UiText>
			{run.kind === "running" ? `Running ${run.argv.join(" ")} ...` : `${what} has not run yet.`}
		</UiText>
	);
}

function Failed({
	title,
	run,
}: {
	title: string;
	run: Extract<Run<unknown>, { kind: "failed" }>;
}): ReactNode {
	return (
		<Box flexDirection="column">
			<UiText bold intent="error">
				{title}
			</UiText>
			<UiText>
				{run.argv.join(" ")} ({run.exitCode === null ? "did not run" : `exit ${run.exitCode}`})
			</UiText>
			<UiText>
				{truncateLines(
					run.error ? `${run.error.observed}\n${run.error.remediation}` : run.output,
					16,
				)}
			</UiText>
		</Box>
	);
}

export function Welcome({ session }: { session: Session }): ReactNode {
	return (
		<Box flexDirection="column">
			<Text bold>Install Disk Plan</Text>
			<UiText>
				Plan, check and apply a partition layout with recpart; every command it runs is shown.
			</UiText>
			<Blank />
			<Text bold>{`Pages (${PAGES.length})`}</Text>
			{PAGES.map((p, i) => (
				<UiText
					key={p.id}
				>{`${i + 1}. ${p.id}${p.gate ? `: continue when ${p.gate.rule}` : ""}`}</UiText>
			))}
			<Blank />
			<UiText>
				Disk: {session.disk ? diskPath(session.disk) : "(none yet)"} | Mode: {session.mode}
			</UiText>
		</Box>
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
		<Box flexDirection="column">
			<Text bold>Target Disk</Text>
			{listing.kind === "running" ? <UiText>Running recpart list-disks --json ...</UiText> : null}
			{listing.kind === "error" ? (
				<UiText intent="error">recpart list-disks failed: {listing.message}</UiText>
			) : null}
			{listing.kind === "done" && choices.length === 0 ? (
				<UiText>recpart listed no disks.</UiText>
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
						borderColor={resolveIntentColor(theme, isSelected ? "accent" : "dimText", colors)}
					>
						<UiText bold intent={isSelected ? "accent" : "text"}>
							{isSelected ? "▸ " : "  "}
							{diskPath(choice)}
						</UiText>
						{choice.kind === "unlisted" ? (
							<UiText intent="warning">not listed by recpart (it will say why)</UiText>
						) : (
							<DiskFacts disk={choice.disk} />
						)}
					</Box>
				)}
			/>
		</Box>
	);
}

/** Vendor strings that only name the transport carry no information. */
const GENERIC_VENDORS = new Set(["ATA", "NVME", "SCSI"]);

function DiskFacts({ disk }: { disk: Extract<DiskChoice, { kind: "listed" }>["disk"] }): ReactNode {
	const vendor = known(disk.vendor);
	return (
		<>
			<UiText>size: {formatBytes(disk.size_bytes)}</UiText>
			{vendor && !GENERIC_VENDORS.has(vendor.toUpperCase()) ? (
				<UiText>vendor: {vendor}</UiText>
			) : null}
			<UiText>model: {known(disk.model) ?? "(unknown)"}</UiText>
			<UiText>transport: {known(disk.transport) ?? "(unknown)"}</UiText>
			<UiText>serial: {known(disk.serial) ?? "(unknown)"}</UiText>
			<UiText>
				{disk.rotational ? "rotational" : "non-rotational"}
				{disk.removable ? " | removable" : " | fixed"}
				{disk.read_only ? " | read-only" : ""}
			</UiText>
		</>
	);
}

export function ModeSelection({
	mode,
	defaultMode,
}: {
	mode: InstallMode;
	defaultMode: InstallMode;
}): ReactNode {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	return (
		<Box flexDirection="column">
			<Text bold>Mode Selection</Text>
			<UiText>
				The layout recpart plans; the default ({defaultMode}) is the one this system was launched
				with.
			</UiText>
			<Blank />
			<Box flexDirection="row" gap={1}>
				{INSTALL_MODES.map((option) => (
					<Box
						key={option}
						flexDirection="column"
						paddingX={1}
						width={`${Math.floor(100 / INSTALL_MODES.length)}%`}
						borderStyle={inkBorderStyle(theme.chrome.borderGlyphSet)}
						borderColor={resolveIntentColor(theme, option === mode ? "accent" : "dimText", colors)}
					>
						<UiText bold intent={option === mode ? "accent" : "text"}>
							{option === mode ? "▸ " : "  "}
							{option}
							{option === defaultMode ? " (default)" : ""}
						</UiText>
						<UiText>{INSTALL_MODE_HELP[option]}</UiText>
					</Box>
				))}
			</Box>
		</Box>
	);
}

export function PlanPreview({ plan }: { plan: Run<PartitionPlan> }): ReactNode {
	if (plan.kind === "failed") return <Failed title="Plan failed" run={plan} />;
	if (plan.kind !== "ok") return <Pending run={plan} what="The plan" />;
	const value = plan.value;
	return (
		<Box flexDirection="column">
			<Text bold>Plan</Text>
			<UiText>
				{value.disk.path} | {formatBytes(value.disk.size_bytes)} | mode {value.mode}
			</UiText>
			{value.partitions.map((partition) => (
				<UiText key={`${partition.index}-${partition.name}`}>
					#{partition.index} {partition.name} {partition.filesystem} {partition.mountpoint}{" "}
					{partition.size_mb === null ? "(rest)" : `(${partition.size_mb}MB)`}
				</UiText>
			))}
			<Blank />
			<Text bold>sfdisk script</Text>
			<UiText>{value.sfdisk_script.trimEnd()}</UiText>
		</Box>
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
	if (dryRun.kind === "failed") return <Failed title="Dry run failed" run={dryRun} />;
	return (
		<Box flexDirection="column">
			<Text bold>Commands run so far</Text>
			{log.map((run, i) =>
				run.kind === "idle" ? null : (
					<UiText key={i}>
						{run.argv.join(" ")}{" "}
						{run.kind === "running" ? "(running)" : run.kind === "ok" ? "(ok)" : `(failed)`}
					</UiText>
				),
			)}
			<Blank />
			<Text bold>What apply would do</Text>
			{dryRun.kind === "ok" ? (
				dryRun.value.steps.map((step, i) => (
					<UiText key={i}>{stepLine(step.phase, step.command, step.status)}</UiText>
				))
			) : (
				<Pending run={dryRun} what="The dry run" />
			)}
		</Box>
	);
}

export function PreflightChecks({ session }: { session: Session }): ReactNode {
	if (session.dryRun.kind !== "ok") return <Pending run={session.dryRun} what="The dry run" />;
	const refused = refusals(session);
	return (
		<Box flexDirection="column">
			<Text bold>Preflight</Text>
			<UiText>From {session.dryRun.argv.join(" ")}:</UiText>
			{refused.length === 0 ? (
				<UiText intent="success">[OK] recpart would apply to this disk.</UiText>
			) : (
				<>
					<UiText bold intent="warning">
						Apply would refuse this disk:
					</UiText>
					{refused.map((reason) => (
						<UiText key={reason}>[FAIL] {reason}</UiText>
					))}
					<UiText>Fix these, then go back to command-preview to run the dry run again.</UiText>
				</>
			)}
		</Box>
	);
}

export function DestructiveConfirm({ session }: { session: Session }): ReactNode {
	const disk = session.disk;
	const listed = disk?.kind === "listed" ? disk.disk : null;
	const unlocked = canApply(session);
	return (
		<Box flexDirection="column">
			<UiText bold intent={unlocked ? "success" : "warning"}>
				Destructive apply
			</UiText>
			<UiText bold intent="error">
				ALL DATA on {disk ? diskPath(disk) : "(no disk)"} will be erased.
			</UiText>
			{listed ? (
				<UiText>
					{formatBytes(listed.size_bytes)} | model {known(listed.model) ?? "(unknown)"} | serial{" "}
					{known(listed.serial) ?? "(unknown)"}
				</UiText>
			) : null}
			<UiText>Mode: {session.mode}</UiText>
			<Blank />
			<UiText>
				Type {CONFIRM_TOKEN} to unlock: {session.token || "(empty)"}
			</UiText>
			<UiText>{unlocked ? "Unlocked: Enter starts the apply." : "Locked."}</UiText>
		</Box>
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
		return <Failed title="Apply failed (Next: diagnostics)" run={apply} />;
	if (apply.kind === "ok") {
		return (
			<Box flexDirection="column">
				<UiText bold intent="success">
					Apply completed (Next: handoff)
				</UiText>
				{apply.value.steps.map((step, i) => (
					<UiText key={i}>{stepLine(step.phase, step.command, step.status)}</UiText>
				))}
			</Box>
		);
	}
	return (
		<Box flexDirection="column">
			<Text bold>Applying</Text>
			<Pending run={apply} what="The apply" />
			{dryRun.kind === "ok"
				? dryRun.value.steps.map((step, i) => (
						<UiText key={i}>{stepLine(step.phase, step.command, null)}</UiText>
					))
				: null}
		</Box>
	);
}

/** What the user runs after the disk is ready: this installer's guidance. */
function nextInstallSteps(target: string): string[] {
	return [
		`recstrap ${target}`,
		`recfstab ${target} >> ${target}/etc/fstab`,
		`recchroot ${target}   (then set a root password and install the bootloader)`,
	];
}

export function ResultHandoff({ apply }: { apply: Run<ApplyResult> }): ReactNode {
	if (apply.kind !== "ok") return <UiText>The apply has not succeeded.</UiText>;
	const handoff = apply.value.handoff;
	return (
		<Box flexDirection="column">
			<Text bold>Handoff</Text>
			<UiText>Install target: {handoff.install_target}</UiText>
			{handoff.mount_map.map((entry) => (
				<UiText key={`${entry.path}-${entry.device}`}>
					{entry.path} {"<-"} {entry.device}
				</UiText>
			))}
			{handoff.mode_context.install_target_slot ? (
				<UiText>
					A/B slot installed now: {handoff.mode_context.install_target_slot} (slot{" "}
					{handoff.mode_context.inactive_slot_hint} stays unmounted)
				</UiText>
			) : null}
			<Blank />
			<Text bold>Next steps</Text>
			{nextInstallSteps(handoff.install_target).map((step) => (
				<UiText key={step}>{step}</UiText>
			))}
		</Box>
	);
}

export function FailureDiagnostics({ session }: { session: Session }): ReactNode {
	const failure = lastFailure(session);
	if (!failure) return <UiText>Nothing has failed.</UiText>;
	if (failure.step === "preflight") {
		return (
			<Box flexDirection="column">
				<UiText bold intent="error">
					Preflight: apply would refuse this disk
				</UiText>
				{failure.refusals.map((reason) => (
					<UiText key={reason}>{reason}</UiText>
				))}
			</Box>
		);
	}
	const { run } = failure;
	return (
		<Box flexDirection="column">
			<Failed title={`Failure in ${failure.step}`} run={run} />
			{run.error ? (
				<>
					<UiText>Code: {run.error.code}</UiText>
					<UiText>Component: {run.error.component}</UiText>
					<UiText>Expectation: {run.error.expectation}</UiText>
				</>
			) : null}
		</Box>
	);
}
