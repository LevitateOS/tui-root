/** The pages: where the system goes, the check, the copy with its progress, the fstab to
 * review and write, and what was recorded. */
import { Box } from "ink";
import { useContext, type ReactNode } from "react";
import {
	BigFigure,
	Callout,
	CellGrid,
	CellRows,
	Commands,
	ContentWidth,
	Facts,
	FromTo,
	Heading,
	ProgressBar,
	Section,
	Table,
	truncateLine,
	UiText,
	useSurfaceBackground,
	formatBytes,
	formatCount,
	type ColorIntent,
	type PageAction,
	type PageNote,
} from "@levitate/tui-kit";
import { type Then } from "@levitate/install-state";
import { guideSteps } from "@levitate/docs-content/install";
import type { FstabResult } from "../generated/recstrap";
import {
	conflicts,
	copyFraction,
	currentPage,
	formatDuration,
	remaining,
	waitsFor,
	type Failure,
	type PageId,
	type Session,
} from "../domain/base";
import type { Prompt } from "./use-base";

/** The one thing to press on a page, or the quiet line in its place. */
export function pageAction(
	session: Session,
	page: PageId,
	prompt: Prompt | null,
	then: Then,
): PageAction | PageNote | undefined {
	const { target, check, copy, fstab, write, saved } = session;
	const press = (label: string): PageAction => ({ label, key: "Enter" });
	const waiting = waitsFor(session, page);
	if (page === "overview") {
		if (!target)
			return { note: "finish the disk step first, or start with --target", intent: "warning" };
		const next = currentPage(session);
		return press(
			next === "check"
				? "Check the target"
				: next === "copy"
					? "Copy the system"
					: next === "fstab"
						? "Write the fstab"
						: "Done",
		);
	}
	if (waiting) return { note: `waits for ${waiting}` };
	if (page === "check") {
		if (check.kind === "ok") return press("Copy the system");
		if (check.kind === "failed") return { note: "r checks again once it is fixed" };
		return { note: "checking the target…", intent: "warning" };
	}
	if (page === "copy") {
		if (copy.kind === "idle") return press("Start the copy");
		if (copy.kind === "running")
			return { note: "it cannot be stopped half-way", intent: "warning" };
		if (copy.kind === "ok") return press("Write the fstab");
		return press("Check the target again");
	}
	if (page === "fstab") {
		if (prompt) return undefined;
		if (write.kind === "ok") return press("Go on");
		if (write.kind === "running") return { note: "writing the fstab…", intent: "warning" };
		if (fstab.kind === "running") return { note: "reading the mounts…", intent: "warning" };
		if (fstab.kind === "failed") return { note: "r reads the mounts again" };
		return press("Write the fstab");
	}
	if (saved?.kind === "ok" && write.kind === "ok") {
		return then === "hub"
			? press("Configure the system")
			: { note: "next: configure the system, with the install guide" };
	}
	return { note: "waits for the fstab to be written" };
}

function Waiting({ session, page }: { session: Session; page: PageId }): ReactNode {
	return (
		<Callout tone="info" title="Not yet">
			<UiText>Waits for {waitsFor(session, page)}.</UiText>
		</Callout>
	);
}

/** What ran and how it ended, as a short section under a failure. */
function WhatRan({ failure }: { failure: Failure }): ReactNode {
	return (
		<Section title="What ran" trailing={`exit ${failure.exitCode ?? "?"}`}>
			<Commands lines={[failure.argv.join(" ")]} />
		</Section>
	);
}

/** A run that failed, as plain text: recstrap's or recfstab's message in the error colour
 * and what to do about it under it. */
function FailureText({ failure }: { failure: Failure }): ReactNode {
	const { error } = failure;
	return (
		<Box flexDirection="column">
			<UiText intent="error">
				{error ? `${error.message} (${error.code})` : failure.output || "no output"}
			</UiText>
			{error?.remediation ? <UiText intent="info">{error.remediation}</UiText> : null}
			<Box marginTop={1} flexDirection="column">
				<WhatRan failure={failure} />
			</Box>
		</Box>
	);
}

/** A run that failed, as a verdict panel. */
function FailureCallout({ title, failure }: { title: string; failure: Failure }): ReactNode {
	const { error } = failure;
	return (
		<Box flexDirection="column">
			<Callout tone="danger" title={title}>
				<UiText>
					{error ? `${error.message} (${error.code})` : failure.output || "no output"}
				</UiText>
				{error?.remediation ? <UiText intent="warning">{error.remediation}</UiText> : null}
			</Callout>
			<WhatRan failure={failure} />
		</Box>
	);
}

export function OverviewPage({
	session,
	stateError,
}: {
	session: Session;
	stateError: string | null;
}): ReactNode {
	const { target, check } = session;
	const checked = check.kind === "ok" ? check.value : null;
	const disk = target?.disk;
	return (
		<Box flexDirection="column">
			<Heading
				title="Copy the system onto the disk"
				subtitle={`Install ${guideSteps("installation-base")}: check the target, copy the system to it, write down its mounts.`}
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
				<Box flexDirection="column">
					<FromTo
						from={{
							title: "The live image",
							lines: checked
								? [checked.rootfs, `${formatBytes(checked.rootfs_bytes)}, compressed`]
								: ["found when the target is checked"],
						}}
						to={{
							title: target.path,
							lines: [
								disk
									? `${disk.disk}, ${disk.mode === "ab" ? "A/B" : "mutable"} layout`
									: "mounted by hand",
								...(checked ? [`${formatBytes(checked.free_bytes)} free`] : []),
							],
						}}
					/>
					{disk && disk.mounts.length > 0 ? (
						<Table
							columns={[{ title: "Mount point" }, { title: "Device" }]}
							rows={disk.mounts.map((mount) => [mount.path, mount.device])}
						/>
					) : null}
				</Box>
			)}
		</Box>
	);
}

/** How much of the target's free space the image takes: the taken part in the accent,
 * a line of words under it. */
function Gauge({ used, total, text }: { used: number; total: number; text: string }): ReactNode {
	const width = useContext(ContentWidth);
	const grid = new CellGrid(width, 3, useSurfaceBackground());
	const taken = total > 0 ? Math.min(width, Math.max(1, Math.round((width * used) / total))) : 0;
	grid.fill(0, 0, taken, "accent");
	grid.fill(0, taken, width - taken, "panelBorder");
	grid.put(1, 0, truncateLine(text, width), "dimText");
	return <CellRows grid={grid} />;
}

export function CheckPage({ session }: { session: Session }): ReactNode {
	const { check, target } = session;
	if (check.kind === "failed") {
		return (
			<Box flexDirection="column">
				<Heading
					glyph="bang"
					tone="error"
					title="The target cannot take it"
					subtitle="Nothing was copied."
				/>
				<FailureText failure={check.failure} />
			</Box>
		);
	}
	const heading = (
		<Heading
			step={1}
			title="Can the target take it?"
			subtitle="recstrap checks before a single file is copied: the target, the system image and this system."
		/>
	);
	if (!target) {
		return (
			<Box flexDirection="column">
				{heading}
				<Waiting session={session} page="check" />
			</Box>
		);
	}
	if (check.kind !== "ok") {
		return (
			<Box flexDirection="column">
				{heading}
				<UiText intent="warning">Checking {target.path}…</UiText>
			</Box>
		);
	}
	const { value } = check;
	return (
		<Box flexDirection="column">
			{heading}
			<Gauge
				used={value.rootfs_bytes}
				total={value.free_bytes}
				text={`The image is ${formatBytes(value.rootfs_bytes)}, compressed; ${formatBytes(value.free_bytes)} are free on the target.`}
			/>
			<Box>
				<UiText intent="success" bold>
					✓{" "}
				</UiText>
				<UiText>{value.checks} checks passed. Ready to copy.</UiText>
			</Box>
			<Box marginTop={1}>
				<Facts
					rows={[
						["Target", value.target],
						["System image", value.rootfs],
					]}
				/>
			</Box>
		</Box>
	);
}

export function CopyPage({ session, now }: { session: Session; now: number }): ReactNode {
	const { copy, check, target } = session;
	const into = target?.path ?? "the target";
	if (copy.kind === "idle") {
		return (
			<Box flexDirection="column">
				<Heading
					step={2}
					title="Copy the system"
					subtitle={`recstrap copies the system image to ${into}, keeping ownership, permissions, capabilities and extended attributes.`}
				/>
				{waitsFor(session, "copy") ? (
					<Waiting session={session} page="copy" />
				) : (
					<Box flexDirection="column">
						{check.kind === "ok" ? (
							<Facts
								rows={[
									["From", check.value.rootfs],
									["To", check.value.target],
									["Image size", `${formatBytes(check.value.rootfs_bytes)} (compressed)`],
								]}
							/>
						) : null}
						<Box marginTop={1}>
							<UiText intent="dimText">
								It takes a few minutes, and the screen stays here until it finishes.
							</UiText>
						</Box>
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
				<Heading step={2} title="Copying the system" subtitle="It cannot be stopped half-way." />
				<Box>
					<Box width={26} flexShrink={0} flexDirection="column" marginTop={1}>
						{fraction === null ? null : <BigFigure text={`${Math.floor(fraction * 100)}%`} />}
					</Box>
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
				<Box marginTop={1}>
					<ProgressBar fraction={fraction} />
				</Box>
				<Box marginTop={1}>
					<UiText intent="dimText">
						{!copy.start
							? "Mounting the system image and counting its files…"
							: copy.verifying
								? "Checking the copied system…"
								: "Copying…"}
					</UiText>
				</Box>
			</Box>
		);
	}
	if (copy.kind === "ok") {
		return (
			<Box flexDirection="column">
				<Heading
					glyph="check"
					tone="success"
					title="System copied"
					subtitle={`recstrap put the system image on ${into}.`}
				/>
				<Facts
					rows={[
						["Files", formatCount(copy.done.entries)],
						["Written", formatBytes(copy.done.bytes)],
						["Took", formatDuration(copy.done.duration_ms)],
					]}
				/>
				<Box marginTop={1}>
					<ProgressBar fraction={1} />
				</Box>
			</Box>
		);
	}
	return (
		<Box flexDirection="column">
			<Heading
				glyph="bang"
				tone="error"
				title="The copy stopped"
				subtitle={
					total
						? `Stopped after ${formatCount(copy.entries)} of ${formatCount(total.total_entries)} files.`
						: "It stopped before the files were counted."
				}
			/>
			<ProgressBar fraction={fraction} tone="danger" />
			<Box marginY={1} flexDirection="column">
				<FailureText failure={copy.failure} />
			</Box>
			<UiText intent="warning">
				The target holds part of a system now: recstrap won't copy onto it again until it's empty.
				Run disk-plan again to format it (or empty it by hand), then press Enter here to check it
				again.
			</UiText>
		</Box>
	);
}

type DiffKind = " " | "-" | "+";
type DiffLine = { kind: DiffKind; number: number; fields: string[] };

/** An entry's fields as recfstab wrote them, from its fstab line. */
function entryFields(entry: FstabResult["entries"][number]): string[] {
	const line = entry.text.split("\n").find((text) => text.trim() !== "" && !text.startsWith("#"));
	return line
		? line.trim().split(/\s+/)
		: [entry.spec, entry.file, entry.fstype, entry.options, String(entry.pass)];
}

/** The fstab as it will be written: its lines that stay, the conflicting lines going out
 * and the entries coming in (each beside the line it replaces, the rest after the last). */
export function fstabDiff(fstab: FstabResult): DiffLine[] {
	const lines: DiffLine[] = [];
	const used = new Set<number>();
	for (const line of [...fstab.existing].sort((a, b) => a.line - b.line)) {
		const fields = [line.spec, line.file, line.fstype];
		if (!line.conflicts) {
			lines.push({ kind: " ", number: line.line, fields });
			continue;
		}
		lines.push({ kind: "-", number: line.line, fields });
		const at = fstab.entries.findIndex((entry, i) => !used.has(i) && entry.file === line.file);
		if (at >= 0) {
			used.add(at);
			lines.push({ kind: "+", number: line.line, fields: entryFields(fstab.entries[at]!) });
		}
	}
	let number = Math.max(0, ...fstab.existing.map((line) => line.line));
	fstab.entries.forEach((entry, i) => {
		if (!used.has(i)) lines.push({ kind: "+", number: ++number, fields: entryFields(entry) });
	});
	return lines;
}

const DIFF_TONE: Record<DiffKind, ColorIntent> = { " ": "info", "-": "error", "+": "success" };

/** A file as it will be written: its path on a raised row, then line numbers, a mark and
 * the line; lines going out in the error colour, lines coming in in success. */
function FileDiff({ title, lines }: { title: string; lines: readonly DiffLine[] }): ReactNode {
	const width = useContext(ContentWidth);
	const grid = new CellGrid(width, lines.length + 1, useSurfaceBackground());
	grid.fill(0, 0, width, "raisedBackground");
	grid.put(0, 2, truncateLine(title, width - 4), "info", "raisedBackground", true);
	const widths = [0, 1, 2].map((i) =>
		Math.max(0, ...lines.map((line) => line.fields[i]?.length ?? 0)),
	);
	lines.forEach(({ kind, number, fields }, i) => {
		const row = i + 1;
		const tone = DIFF_TONE[kind];
		const text = fields
			.map((field, column) => (column < 3 ? field.padEnd(widths[column]!) : field))
			.join("  ");
		grid.fill(row, 0, width, "panelBackground");
		grid.put(row, 1, String(number).padStart(2), "faintText", "panelBackground");
		grid.put(row, 5, kind, tone, "panelBackground", true);
		grid.put(row, 7, truncateLine(text, Math.max(1, width - 9)), tone, "panelBackground");
	});
	return <CellRows grid={grid} />;
}

export function FstabPage({
	session,
	prompt,
}: {
	session: Session;
	prompt: Prompt | null;
}): ReactNode {
	const { fstab, write, target } = session;
	const heading = (
		<Heading
			step={3}
			title="Write down the mounts"
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
			</Box>
		);
	const value = fstab.value;
	const replaced = conflicts(value);
	const diff = fstabDiff(value);
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
					keys={[
						["y", "replace them"],
						["n", "keep the file"],
					]}
				>
					<UiText>They describe mount points the new entries describe too.</UiText>
				</Callout>
			) : null}
			{value.warnings.map((warning) => (
				<Callout key={warning} tone="warning" title="Check this before booting">
					<UiText>{warning}</UiText>
				</Callout>
			))}
			<FileDiff
				title={value.fstab_path}
				lines={prompt ? diff.filter((line) => line.kind !== " ") : diff}
			/>
		</Box>
	);
}

export function DonePage({ session }: { session: Session }): ReactNode {
	const { saved, copy, write } = session;
	const width = useContext(ContentWidth);
	const background = useSurfaceBackground();
	if (!saved || write.kind !== "ok") {
		return (
			<Box flexDirection="column">
				<Heading title="Done" />
				<Waiting session={session} page="done" />
			</Box>
		);
	}
	const column = Math.floor(width / 3);
	const figures: [string, string][] =
		copy.kind === "ok"
			? [
					[formatCount(copy.done.entries), "files"],
					[formatBytes(copy.done.bytes), "written"],
					[formatDuration(copy.done.duration_ms), "taken"],
				]
			: [];
	const grid = new CellGrid(width, 2, background);
	figures.forEach(([figure, label], i) => {
		grid.put(0, i * column, figure, "text", undefined, true);
		grid.put(1, i * column, label, "dimText");
	});
	return (
		<Box flexDirection="column">
			<Heading
				glyph="check"
				tone="success"
				title="The system is on the disk"
				subtitle="Copied, and it knows its mounts."
			/>
			{saved.kind === "ok" ? null : (
				<Callout tone="warning" title="The step isn't recorded">
					<UiText>
						The system is copied and its fstab written, but {saved.path} couldn't be updated:{" "}
						{saved.message}. The install steps won't know this step is done.
					</UiText>
				</Callout>
			)}
			<CellRows grid={grid} />
			<Box marginTop={1}>
				<UiText intent="dimText">{saved.kind === "ok" ? `Recorded in ${saved.path}.` : ""}</UiText>
			</Box>
		</Box>
	);
}
