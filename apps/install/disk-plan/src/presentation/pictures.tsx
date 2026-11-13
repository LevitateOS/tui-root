/** The parts of disk-plan's pages that the kit does not carry, drawn cell by cell as the
 * design draws them: the overview's line, the disks to choose from, the two slot cards,
 * the choice of two for the disk, the layout's needs, and the mount labels under a bar. */
import { Text } from "ink";
import { useContext, type ReactNode } from "react";
import {
	CellGrid,
	CellRows,
	ContentWidth,
	diskBarSpans,
	formatBytes,
	shortDevice,
	textWidth,
	truncateLine,
	useIntentColor,
	useSurfaceBackground,
	type ColorIntent,
	type DiskPart,
} from "@levitate/tui-kit";
import type {
	InspectResult,
	PartitionChange,
	PartitionInfo,
	PartitionPlan,
	Role,
} from "../generated/recpart";
import { isEfi } from "../domain/setup";
import type { Projection, Segment } from "../domain/layout";

/** One line of styled runs, each nested Text on the surface's own background. */
export function Runs({
	runs,
}: {
	runs: ReadonlyArray<readonly [text: string, intent: ColorIntent, bold?: boolean]>;
}): ReactNode {
	const color = useIntentColor();
	const background = color(useSurfaceBackground());
	return (
		<Text backgroundColor={background}>
			{runs.map(([text, intent, bold], i) => (
				<Text key={i} color={color(intent)} bold={bold} backgroundColor={background}>
					{text}
				</Text>
			))}
		</Text>
	);
}

/** Plain text broken at spaces into lines at most `width` cells wide. */
export function wrapWords(text: string, width: number): string[] {
	const limit = Math.max(1, width);
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(" ")) {
		if (line && textWidth(line) + 1 + textWidth(word) > limit) {
			lines.push(line);
			line = word;
		} else {
			line = line ? `${line} ${word}` : word;
		}
	}
	if (line) lines.push(line);
	return lines.map((part) => truncateLine(part, limit));
}

/** What the overview says about each stage of the flow. */
export type Stage = { title: string; text: string };

/** The overview's picture: the line where writing starts. Choosing and reviewing are
 * safe (in success), one cell is the line itself, applying is what writes (in error). */
export function WritingLine({
	stages,
	note,
}: {
	stages: readonly Stage[];
	note: string;
}): ReactNode {
	const width = useContext(ContentWidth);
	const grid = new CellGrid(width, 6, useSurfaceBackground());
	const safe = Math.round((width * 8) / 10);
	const third = Math.floor(safe / 2);
	const last = stages[2];
	const columns = [0, third, Math.min(safe + 2, Math.max(0, width - textWidth(last?.text ?? "")))];
	stages.forEach((stage, i) => {
		const at = columns[i] ?? 0;
		grid.put(0, at, truncateLine(stage.title, Math.max(1, width - at)), "text", undefined, true);
		grid.put(1, at, truncateLine(stage.text, Math.max(1, width - at)), "dimText");
	});
	grid.fill(3, 0, safe, "success");
	grid.fill(3, safe, 1, "text");
	grid.fill(3, safe + 1, Math.max(0, width - safe - 1), "error");
	grid.put(5, 0, truncateLine(note, width), "info");
	return <CellRows grid={grid} />;
}

/** One disk to choose from. */
export type DiskLine = {
	path: string;
	/** Null when recpart did not list it (a `--disk` it does not know). */
	size: number | null;
	detail: string;
	warn: boolean;
};

/** Disks to choose from: each its name and size, a bar as long as its share of the
 * largest disk, and one line about it. The chosen one has the accent edge. */
export function DiskLines({
	disks,
	selected,
}: {
	disks: readonly DiskLine[];
	selected: number;
}): ReactNode {
	const width = useContext(ContentWidth);
	const grid = new CellGrid(width, Math.max(1, disks.length * 4 - 1), useSurfaceBackground());
	const largest = Math.max(1, ...disks.map((disk) => disk.size ?? 0));
	const bar = Math.max(1, width - 2);
	disks.forEach((disk, i) => {
		const top = i * 4;
		const chosen = i === selected;
		if (chosen) for (let r = 0; r < 3; r++) grid.put(top + r, 0, "▌", "accent");
		grid.put(top, 2, truncateLine(disk.path, Math.max(1, width - 14)), "text", undefined, chosen);
		const size = disk.size === null ? "" : formatBytes(disk.size);
		grid.put(top, width - textWidth(size), size, "text", undefined, chosen);
		grid.fill(top + 1, 2, bar, "panelBorder");
		if (disk.size !== null) {
			grid.fill(
				top + 1,
				2,
				Math.max(2, Math.round((bar * disk.size) / largest)),
				chosen ? "accent" : "info",
			);
		}
		grid.put(
			top + 2,
			2,
			truncateLine(disk.detail, Math.max(1, width - 2)),
			disk.warn ? "warning" : "dimText",
		);
	});
	return <CellRows grid={grid} />;
}

/** A slot of an update layout, drawn as a small block. */
export type SlotBox = { label: string; state: string; running: boolean };

export type SlotCard = {
	title: string;
	/** A dim word at the end of the title, such as "default". */
	tag?: string;
	slots: readonly SlotBox[];
	text: string;
};

/** The choice of how the system updates: each answer as the slots it leaves, with a
 * sentence under them. The chosen one is in the accent. */
export function SlotCards({
	cards,
	selected,
}: {
	cards: readonly SlotCard[];
	selected: number;
}): ReactNode {
	const width = useContext(ContentWidth);
	const each = Math.max(12, Math.floor((width - 3) / Math.max(1, cards.length)));
	const wrapped = cards.map((card) => wrapWords(card.text, each));
	const height = 6 + Math.max(0, ...wrapped.map((lines) => lines.length));
	const grid = new CellGrid(width, height, useSurfaceBackground());
	cards.forEach((card, i) => {
		const x = i * (each + 3);
		const chosen = i === selected;
		grid.put(
			0,
			x,
			`${chosen ? "● " : "○ "}${card.title}`,
			chosen ? "accent" : "text",
			undefined,
			true,
		);
		if (card.tag) grid.put(0, x + each - textWidth(card.tag), card.tag, "dimText");
		let at = x;
		for (const slot of card.slots) {
			const box = card.slots.length > 1 ? Math.floor((each - 1) / 2) : each;
			const background: ColorIntent = slot.running ? (chosen ? "accent" : "info") : "panelBorder";
			for (let r = 2; r < 5; r++) grid.fill(r, at, box, background);
			grid.put(
				2,
				at + 2,
				truncateLine(slot.label, Math.max(1, box - 3)),
				slot.running ? "onFill" : "text",
				background,
				true,
			);
			grid.put(
				3,
				at + 2,
				truncateLine(slot.state, Math.max(1, box - 3)),
				slot.running ? "onFill" : "text",
				background,
			);
			at += box + 1;
		}
		wrapped[i]!.forEach((line, j) => grid.put(6 + j, x, line, chosen ? "info" : "dimText"));
	});
	return <CellRows grid={grid} />;
}

/** The title of one of the two answers about the disk, and what that answer costs at the
 * title's end, in a tone. */
export function ChoiceTitle({
	chosen,
	title,
	cost,
	tone,
}: {
	chosen: boolean;
	title: string;
	cost: string;
	tone: ColorIntent;
}): ReactNode {
	const width = useContext(ContentWidth);
	const grid = new CellGrid(width, 1, useSurfaceBackground());
	const left = grid.put(
		0,
		0,
		`${chosen ? "● " : "○ "}${title}`,
		chosen ? "accent" : "text",
		undefined,
		true,
	);
	const room = Math.max(0, width - left - 2);
	const shown = truncateLine(cost, room);
	grid.put(0, width - textWidth(shown), shown, tone);
	return <CellRows grid={grid} />;
}

/** One row of space the width of the page, for a picture that is not there. */
export function BlankRow(): ReactNode {
	const width = useContext(ContentWidth);
	return <CellRows grid={new CellGrid(width, 1, useSurfaceBackground())} />;
}

/** One thing a layout needs and what holds it now. */
export type Need = { name: string; got: string; met: boolean };

/** What the layout still needs: a title, then each need with a mark and what holds it. */
export function Needs({
	title,
	needs,
	width,
}: {
	title: string;
	needs: readonly Need[];
	width: number;
}): ReactNode {
	const grid = new CellGrid(width, needs.length + 3, "panelBackground");
	grid.put(1, 2, truncateLine(title, Math.max(1, width - 4)), "info", undefined, true);
	needs.forEach((need, i) => {
		const row = 2 + i;
		grid.put(row, 2, need.met ? "✓" : "○", need.met ? "success" : "faintText");
		grid.put(
			row,
			4,
			truncateLine(need.name, Math.max(1, width - 6)),
			need.met ? "text" : "dimText",
		);
		const got = truncateLine(need.got, Math.max(1, width - 6 - textWidth(need.name) - 1));
		grid.put(row, width - 2 - textWidth(got), got, "dimText");
	});
	return <CellRows grid={grid} />;
}

/** Labels written under a bar, each at its stretch's first column. A label that would run
 * into the one before it goes on a second row. */
export function BarLabels({
	parts,
	labels,
	total,
}: {
	parts: readonly DiskPart[];
	labels: readonly string[];
	total?: number;
}): ReactNode {
	const width = useContext(ContentWidth);
	const spans = diskBarSpans(parts, width, total);
	// Where each row's last label ends, so the next fits after it.
	const ends = [0, 0];
	const placed: { row: number; col: number; text: string }[] = [];
	labels.forEach((label, i) => {
		const span = spans[i];
		if (!span || !label) return;
		const row = ends.findIndex((end) => span.start >= end);
		const at = row < 0 ? 1 : row;
		placed.push({ row: at, col: span.start, text: label });
		ends[at] = Math.max(ends[at]!, span.start + textWidth(label) + 1);
	});
	const rows = placed.some((label) => label.row === 1) ? 2 : 1;
	const grid = new CellGrid(width, rows, useSurfaceBackground());
	for (const label of placed)
		grid.put(
			label.row,
			label.col,
			truncateLine(label.text, Math.max(1, width - label.col)),
			"dimText",
		);
	return <CellRows grid={grid} />;
}

/** The colour of a stretch by what the new system uses it for. */
const ROLE_INTENT: Record<Role, ColorIntent> = {
	efi: "info",
	root: "accent",
	root_a: "accent",
	root_b: "success",
	state: "warning",
	home: "highlight",
	swap: "link",
	other: "link",
};

/** The short name written inside a stretch. */
const ROLE_SHORT: Record<Role, string> = {
	efi: "EFI",
	root: "root",
	root_a: "A",
	root_b: "B",
	state: "state",
	home: "home",
	swap: "swap",
	other: "",
};

type Stretch = {
	start: number;
	size: number;
	name: string;
	intent: ColorIntent;
	/** What is written under the stretch (see `BarLabels`). */
	label?: string;
};

/** Stretches in disk order as bar parts, with the free space between them as parts in the
 * rule colour; `labels` has one entry for each part. What is left after the last one the
 * bar draws itself. */
function stretchBar(
	stretches: readonly Stretch[],
	total: number,
): { parts: DiskPart[]; labels: string[] } {
	const sorted = [...stretches].sort((a, b) => a.start - b.start);
	const parts: DiskPart[] = [];
	const labels: string[] = [];
	const minimum = total / 200;
	let cursor = 0;
	for (const stretch of sorted) {
		if (stretch.start - cursor > minimum) {
			parts.push({ name: "", size: stretch.start - cursor, intent: "panelBorder" });
			labels.push("");
		}
		parts.push({ name: stretch.name, size: stretch.size, intent: stretch.intent });
		labels.push(stretch.label ?? "");
		cursor = Math.max(cursor, stretch.start + stretch.size);
	}
	return { parts, labels };
}

function stretchParts(stretches: readonly Stretch[], total: number): DiskPart[] {
	return stretchBar(stretches, total).parts;
}

function holds(state: { filesystem: string | null; fs_label: string | null }): string {
	return state.fs_label ?? state.filesystem ?? "";
}

/** The disk as the plan found it: what is on it now, as a bar. */
export function nowParts(plan: PartitionPlan): DiskPart[] {
	return stretchParts(
		plan.summary.flatMap((entry) =>
			entry.before
				? [
						{
							start: entry.before.start_bytes,
							size: entry.before.size_bytes,
							name: holds(entry.before),
							intent: entry.role === "efi" && entry.change === "untouched" ? "info" : "faintText",
						} satisfies Stretch,
					]
				: [],
		),
		plan.disk.size_bytes,
	);
}

function afterName(entry: PartitionChange): string {
	if (entry.role && entry.role !== "other") return ROLE_SHORT[entry.role];
	if (entry.role === "other") return entry.mountpoint ?? "";
	return entry.after ? holds(entry.after) : "";
}

/** The disk as the plan leaves it, as a bar: each new partition by its use. `labelOf`
 * says what is written under a partition's stretch. */
export function afterBar(
	entries: readonly PartitionChange[],
	total: number,
	labelOf?: (entry: PartitionChange) => string,
): { parts: DiskPart[]; labels: string[] } {
	return stretchBar(
		entries.flatMap((entry) =>
			entry.after
				? [
						{
							start: entry.after.start_bytes,
							size: entry.after.size_bytes,
							name: afterName(entry),
							intent: entry.role ? ROLE_INTENT[entry.role] : "faintText",
							label: labelOf?.(entry),
						} satisfies Stretch,
					]
				: [],
		),
		total,
	);
}

export function afterParts(entries: readonly PartitionChange[], total: number): DiskPart[] {
	return afterBar(entries, total).parts;
}

function inspectedStretch(part: PartitionInfo): Stretch {
	return {
		start: part.start_bytes,
		size: part.size_bytes,
		name: part.fs_label ?? part.label ?? part.filesystem ?? "",
		intent: isEfi(part) ? "info" : "faintText",
	};
}

/** The disk as it is now, from what recpart inspect found; a disk with no partition table
 * but a signature on it is one stretch. `free` draws the free gaps in success. */
export function inspectedParts(inspect: InspectResult, free = false): DiskPart[] {
	const total = inspect.disk.size_bytes;
	const stretches: Stretch[] = inspect.partitions.map(inspectedStretch);
	if (inspect.partitions.length === 0 && (inspect.signatures ?? []).length > 0)
		stretches.push({ start: 0, size: total, name: "", intent: "faintText" });
	if (free)
		for (const gap of inspect.free)
			if (gap.size_bytes > total / 50)
				stretches.push({
					start: gap.start_bytes,
					size: gap.size_bytes,
					name: "free",
					intent: "success",
				});
	return stretchParts(stretches, total);
}

/** The disk as the editor's edits leave it: one part for each row of its table, so the
 * selected row is the selected stretch. */
export function segmentParts(projection: Projection): DiskPart[] {
	const intent = (segment: Segment): ColorIntent =>
		segment.kind === "free"
			? "panelBorder"
			: segment.role
				? ROLE_INTENT[segment.role]
				: segment.kind === "new"
					? "success"
					: "faintText";
	const name = (segment: Segment): string => {
		if (segment.kind === "free") return "";
		if (segment.role && segment.role !== "other") return ROLE_SHORT[segment.role];
		if (segment.role === "other") return segment.mountpoint ?? "";
		if (segment.kind === "new") return "new";
		const part = segment.part;
		return part.fs_label ?? part.label ?? part.filesystem ?? shortDevice(part.device);
	};
	return projection.segments.map((segment) => ({
		name: name(segment),
		size: segment.size,
		intent: intent(segment),
	}));
}
