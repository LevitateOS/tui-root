/** The pages: where the system goes, the check, the copy with its progress, the fstab to
 * review and write, and what was recorded. */
import { Box } from "ink";
import type { ReactNode } from "react";
import {
	Callout,
	Commands,
	Facts,
	Heading,
	ProgressBar,
	Section,
	StepList,
	Table,
	truncateLines,
	UiText,
	type ColorIntent,
	type StepStatus,
} from "@levitate/tui-kit";
import { statePath, type Then } from "@levitate/install-state";
import { guideSteps, guideTitle, STEP_INFO } from "@levitate/docs-content/install";
import type { FstabResult } from "../generated/recstrap";
import {
	conflicts,
	copyFraction,
	formatBytes,
	formatCount,
	formatDuration,
	pageState,
	remaining,
	waitsFor,
	type Failure,
	type PageId,
	type Session,
} from "../domain/base";
import type { Prompt } from "./use-base";

function Hint({ children }: { children: ReactNode }): ReactNode {
	return <UiText intent="dimText">{children}</UiText>;
}

function Waiting({ session, page }: { session: Session; page: PageId }): ReactNode {
	return (
		<Callout tone="info" title="Not yet">
			<UiText>Waits for {waitsFor(session, page)}.</UiText>
		</Callout>
	);
}

/** A run that failed: recstrap's or recfstab's message and fix, and the command. */
function FailureCallout({ title, failure }: { title: string; failure: Failure }): ReactNode {
	const { error } = failure;
	return (
		<Box flexDirection="column">
			<Callout tone="danger" title={title}>
				{error ? (
					<UiText>
						{error.message} ({error.code})
					</UiText>
				) : (
					<UiText>{truncateLines(failure.output || "no output", 8)}</UiText>
				)}
				{error?.remediation ? (
					<UiText intent="warning">What to do: {error.remediation}</UiText>
				) : null}
			</Callout>
			<Section title="What ran" trailing={`exit ${failure.exitCode ?? "?"}`}>
				<Commands lines={[failure.argv.join(" ")]} />
			</Section>
		</Box>
	);
}

const STEP_OF: Record<string, StepStatus> = {
	done: "ok",
	running: "running",
	failed: "failed",
	ready: "planned",
	waiting: "planned",
};

export function OverviewPage({
	session,
	stateError,
}: {
	session: Session;
	stateError: string | null;
}): ReactNode {
	const { target } = session;
	return (
		<Box flexDirection="column">
			<Heading
				title="Copy the system onto the disk"
				subtitle={`Install ${guideSteps("installation-base")}: check the target, copy the system to it, and write its fstab.`}
			/>
			{stateError ? (
				<Callout tone="warning" title="The install state file can't be read">
					<UiText>{stateError}</UiText>
				</Callout>
			) : null}
			{!target ? (
				<Callout tone="danger" title="Nowhere to copy to yet">
					<UiText>
						The disk step says where the new system is mounted, and records it for this app. Finish
						it first, or start this app with --target and the path you mounted it at.
					</UiText>
				</Callout>
			) : (
				<Section title="Target">
					<Facts
						rows={[
							["Mounted at", target.path],
							[
								"Disk",
								target.disk
									? `${target.disk.disk}, ${target.disk.mode === "ab" ? "A/B" : "mutable"} layout`
									: "mounted by hand (the install state has no disk step for it)",
							],
						]}
					/>
					{target.disk && target.disk.mounts.length > 0 ? (
						<Box marginTop={1}>
							<Table
								columns={[{ title: "Mount point" }, { title: "Device" }]}
								rows={target.disk.mounts.map((mount) => [mount.path, mount.device])}
							/>
						</Box>
					) : null}
				</Section>
			)}
			<Section title="What happens">
				<StepList
					steps={[
						{
							phase: "",
							command: `Check that ${target?.path ?? "the target"} is empty and mounted, with room for the system`,
							status: STEP_OF[pageState(session, "check")]!,
						},
						{
							phase: "",
							command: "Copy the system image onto it (recstrap)",
							status: STEP_OF[pageState(session, "copy")]!,
						},
						{
							phase: "",
							command: "Describe its mounts in its /etc/fstab (recfstab)",
							status: STEP_OF[pageState(session, "fstab")]!,
						},
					]}
				/>
			</Section>
			{target ? <Hint>Enter goes to the step the install is at.</Hint> : null}
		</Box>
	);
}

export function CheckPage({ session }: { session: Session }): ReactNode {
	const { check, target } = session;
	return (
		<Box flexDirection="column">
			<Heading
				title="Check the target"
				subtitle="recstrap checks before it copies anything: the target must be an empty, mounted filesystem with room for the system, and the system image must be there."
			/>
			{!target ? (
				<Waiting session={session} page="check" />
			) : check.kind === "running" || check.kind === "idle" ? (
				<UiText intent="warning">Checking {target.path}…</UiText>
			) : check.kind === "failed" ? (
				<Box flexDirection="column">
					<FailureCallout title={`${target.path} can't take the system`} failure={check.failure} />
					<Hint>r checks again once it's fixed.</Hint>
				</Box>
			) : (
				<Box flexDirection="column">
					<Callout tone="success" title="Ready to copy">
						<Facts
							rows={[
								["Target", check.value.target],
								["System image", check.value.rootfs],
								["Image size", formatBytes(check.value.rootfs_bytes)],
								["Free space", formatBytes(check.value.free_bytes)],
								["Checks", `${check.value.checks} passed`],
							]}
						/>
					</Callout>
					<Hint>Enter goes on to the copy.</Hint>
				</Box>
			)}
		</Box>
	);
}

export function CopyPage({ session, now }: { session: Session; now: number }): ReactNode {
	const { copy, check, target } = session;
	const heading = (
		<Heading
			title="Copy the system"
			subtitle={`recstrap copies the system image to ${target?.path ?? "the target"}, keeping ownership, permissions, capabilities and extended attributes.`}
		/>
	);
	if (copy.kind === "idle") {
		return (
			<Box flexDirection="column">
				{heading}
				{waitsFor(session, "copy") ? (
					<Waiting session={session} page="copy" />
				) : (
					<Box flexDirection="column">
						{check.kind === "ok" ? (
							<Section title="Copy">
								<Facts
									rows={[
										["From", check.value.rootfs],
										["To", check.value.target],
										["Image size", `${formatBytes(check.value.rootfs_bytes)} (compressed)`],
									]}
								/>
							</Section>
						) : null}
						<Hint>
							Enter starts the copy. It takes a few minutes, and the screen stays here until it
							finishes.
						</Hint>
					</Box>
				)}
			</Box>
		);
	}
	const fraction = copyFraction(copy);
	const total = copy.start;
	if (copy.kind === "running") {
		const left = remaining(copy, now);
		return (
			<Box flexDirection="column">
				{heading}
				<Section title="Progress">
					<ProgressBar fraction={fraction} />
					<Box marginTop={1}>
						<Facts
							rows={[
								[
									"Files",
									total
										? `${formatCount(copy.entries)} of ${formatCount(total.total_entries)}`
										: "counting…",
								],
								[
									"Written",
									total
										? `${formatBytes(copy.bytes)} of about ${formatBytes(total.total_bytes)}`
										: formatBytes(copy.bytes),
								],
								["Elapsed", formatDuration(now - copy.startedAt)],
								["Left", left === null ? "working it out" : `about ${formatDuration(left)}`],
							]}
						/>
					</Box>
				</Section>
				<UiText intent="warning">
					{!copy.start
						? "Mounting the system image and counting its files…"
						: copy.verifying
							? "Checking the copied system…"
							: "Copying…"}
				</UiText>
			</Box>
		);
	}
	if (copy.kind === "ok") {
		return (
			<Box flexDirection="column">
				{heading}
				<Callout tone="success" title="System copied">
					<Facts
						rows={[
							["Files", formatCount(copy.done.entries)],
							["Written", formatBytes(copy.done.bytes)],
							["Took", formatDuration(copy.done.duration_ms)],
						]}
					/>
				</Callout>
				<Hint>Enter goes on to the fstab.</Hint>
			</Box>
		);
	}
	return (
		<Box flexDirection="column">
			{heading}
			<Section title="Progress">
				<ProgressBar fraction={fraction} tone="danger" />
				{total ? (
					<UiText intent="dimText">
						Stopped after {formatCount(copy.entries)} of {formatCount(total.total_entries)} files.
					</UiText>
				) : null}
			</Section>
			<FailureCallout title="The copy stopped" failure={copy.failure} />
			<Callout tone="warning" title="The target holds part of a system now">
				<UiText>
					recstrap won't copy onto it again until it's empty. Run disk-plan again to format it (or
					empty it by hand), then press Enter here to check it again.
				</UiText>
			</Callout>
		</Box>
	);
}

function mountLabel(file: string, fstype: string): string {
	return fstype === "swap" ? "swap" : file;
}

const PASS: Record<number, string> = { 0: "no", 1: "first", 2: "after /" };

function Entries({ fstab }: { fstab: FstabResult }): ReactNode {
	return (
		<Section title="Entries" trailing={`${fstab.entries.length}`}>
			<Table
				columns={[
					{ title: "Mount point" },
					{ title: "Device" },
					{ title: "Type" },
					{ title: "Boot check" },
					{ title: "Options", optional: true },
				]}
				rows={fstab.entries.map((entry) => [
					mountLabel(entry.file, entry.fstype),
					entry.spec,
					entry.fstype,
					PASS[entry.pass] ?? String(entry.pass),
					entry.options,
				])}
			/>
		</Section>
	);
}

function Existing({ fstab }: { fstab: FstabResult }): ReactNode {
	if (fstab.existing.length === 0) return null;
	return (
		<Section title={`Already in ${fstab.fstab_path}`} trailing={`${fstab.existing.length}`}>
			<Table
				columns={[
					{ title: "Line", align: "right" },
					{ title: "Mount point" },
					{ title: "Device" },
					{ title: "Type" },
					{ title: "" },
				]}
				rows={fstab.existing.map((line) => [
					String(line.line),
					mountLabel(line.file, line.fstype),
					line.spec,
					line.fstype,
					line.conflicts ? "replaced" : "kept",
				])}
				tones={fstab.existing.map((line): ColorIntent | null =>
					line.conflicts ? "warning" : null,
				)}
			/>
		</Section>
	);
}

export function FstabPage({
	session,
	prompt,
}: {
	session: Session;
	prompt: Prompt | null;
}): ReactNode {
	const { fstab, write, target } = session;
	const path = target ? `${target.path}/etc/fstab` : "/etc/fstab";
	const heading = (
		<Heading
			title="Write the fstab"
			subtitle={`recfstab describes what is mounted under ${target?.path ?? "the target"}, so the installed system mounts the same filesystems when it boots.`}
		/>
	);
	if (fstab.kind === "idle")
		return (
			<Box flexDirection="column">
				{heading}
				<Waiting session={session} page="fstab" />
			</Box>
		);
	if (fstab.kind === "running")
		return (
			<Box flexDirection="column">
				{heading}
				<UiText intent="warning">Reading the mounts under {target?.path}…</UiText>
			</Box>
		);
	if (fstab.kind === "failed")
		return (
			<Box flexDirection="column">
				{heading}
				<FailureCallout title="recfstab couldn't describe the mounts" failure={fstab.failure} />
				<Hint>r reads the mounts again.</Hint>
			</Box>
		);
	const value = fstab.value;
	const replaced = conflicts(value);
	return (
		<Box flexDirection="column">
			{heading}
			{write.kind === "ok" ? (
				<Callout tone="success" title={`Written to ${write.value.fstab_path}`}>
					<UiText>
						{write.value.entries.length} entries
						{replaced.length > 0 ? `, replacing ${replaced.length} lines that were there` : ""}.
					</UiText>
				</Callout>
			) : null}
			{write.kind === "failed" ? (
				<FailureCallout title="The fstab wasn't written" failure={write.failure} />
			) : null}
			{prompt ? (
				<Callout
					tone="warning"
					title={`Replace line${prompt.lines.length > 1 ? "s" : ""} ${prompt.lines.join(", ")} of ${value.fstab_path}?`}
				>
					<UiText>
						They describe mount points the new entries describe too, most likely from an earlier
						run. y replaces them; n keeps the file as it is.
					</UiText>
				</Callout>
			) : null}
			{value.warnings.map((warning) => (
				<Callout key={warning} tone="warning" title="Check this before booting">
					<UiText>{warning}</UiText>
				</Callout>
			))}
			<Entries fstab={value} />
			<Existing fstab={value} />
			{write.kind === "running" ? (
				<UiText intent="warning">Writing {value.fstab_path}…</UiText>
			) : write.kind === "ok" || prompt ? null : (
				<Hint>
					Enter writes these entries to {value.fstab_path || path}
					{replaced.length > 0 ? `, replacing ${replaced.length} lines` : ""}. r reads the mounts
					again.
				</Hint>
			)}
		</Box>
	);
}

export function DonePage({ session, then }: { session: Session; then: Then }): ReactNode {
	const { saved, copy, write, target } = session;
	if (!saved || write.kind !== "ok") {
		return (
			<Box flexDirection="column">
				<Heading title="Done" />
				<Waiting session={session} page="done" />
			</Box>
		);
	}
	return (
		<Box flexDirection="column">
			<Heading title="Done" subtitle="The base system is on the disk." />
			{saved.kind === "ok" ? (
				<Callout tone="success" title="Base system installed">
					<UiText>
						Next: {STEP_INFO.setup.title.toLowerCase()}. {STEP_INFO.setup.about}{" "}
						{then === "hub"
							? "Enter or q goes back to the install steps."
							: `The install guide has it (${guideTitle("installation-config")}).`}
					</UiText>
				</Callout>
			) : (
				<Callout tone="warning" title="The step isn't recorded">
					<UiText>
						The system is copied and its fstab written, but {saved.path} couldn't be updated:{" "}
						{saved.message}. The install steps won't know this step is done.
					</UiText>
				</Callout>
			)}
			<Section title="What was done">
				<Facts
					rows={[
						["Target", target?.path ?? ""],
						["Files copied", copy.kind === "ok" ? formatCount(copy.done.entries) : "—"],
						["fstab", `${write.value.fstab_path} (${write.value.entries.length} entries)`],
						["Recorded in", saved.kind === "ok" ? saved.path : statePath()],
					]}
				/>
			</Section>
		</Box>
	);
}
