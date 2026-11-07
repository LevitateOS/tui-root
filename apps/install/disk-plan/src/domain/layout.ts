/**
 * The partition editor's model: the edits made to what `recpart inspect` reported, the
 * disk they would leave (for the table and the bar), and the explicit layout recpart plans
 * from. Placement follows recpart's rules (free runs of at least 1 MiB aligned to 1 MiB;
 * a resize keeps its start and grows into the space after it), so what the editor shows
 * is where recpart puts things; recpart's plan still decides whether the layout is valid.
 */
import type {
	Filesystem,
	InspectResult,
	InstallMode,
	LayoutAction,
	ManualLayout,
	PartitionInfo,
	Role,
} from "../generated/recpart";

export const MIB = 1024 * 1024;
/** GPT's partition entry array, as recpart sizes a new table. */
const GPT_ENTRIES_BYTES = 128 * 128;

/** What the installed system uses a partition for, and where (`other` only). */
export type Assignment = { role: Role | null; mountpoint: string | null };

/** What happens to a partition that is on the disk now. */
export type ExistingEdit =
	| { op: "keep" }
	| { op: "delete" }
	| { op: "resize"; sizeMb: number }
	| { op: "format"; filesystem: Filesystem; label: string | null };

export type NewPartition = Assignment & {
	/** Stable across edits, so a selection can follow it. */
	id: number;
	/** The start of the free run it goes in (MiB); recpart places it there. */
	startMb: number;
	/** Null takes the rest of that run. */
	sizeMb: number | null;
	filesystem: Filesystem | null;
	label: string | null;
};

export type Edits = {
	/** Replace the table with an empty GPT one, erasing every partition. */
	newTable: boolean;
	existing: Readonly<Record<number, Assignment & { edit: ExistingEdit }>>;
	created: readonly NewPartition[];
	nextId: number;
};

export const NO_EDITS: Edits = { newTable: false, existing: {}, created: [], nextId: 1 };

/** One row of the disk as the edits leave it, in disk order. */
export type Segment =
	| (Assignment & {
			kind: "existing";
			part: PartitionInfo;
			edit: ExistingEdit;
			start: number;
			size: number;
	  })
	| (Assignment & { kind: "new"; part: NewPartition; start: number; size: number; fits: boolean })
	| { kind: "free"; start: number; size: number };

export type Projection = {
	segments: Segment[];
	/** Partitions the edits erase (deleted, or every one under a new table). */
	erased: PartitionInfo[];
	usableStart: number;
	usableEnd: number;
};

function alignUp(value: number, to: number): number {
	return Math.ceil(value / to) * to;
}

function alignDown(value: number, to: number): number {
	return Math.floor(value / to) * to;
}

/** Free runs of at least 1 MiB between `extents`, aligned to 1 MiB (recpart's free_gaps). */
function freeGaps(
	usableStart: number,
	usableEnd: number,
	extents: ReadonlyArray<[number, number]>,
): Array<{ start: number; size: number }> {
	const sorted = [...extents].sort((a, b) => a[0] - b[0]);
	const gaps: Array<{ start: number; size: number }> = [];
	let cursor = usableStart;
	for (const [start, end] of [...sorted, [usableEnd, usableEnd] as [number, number]]) {
		const gapStart = alignUp(cursor, MIB);
		const gapEnd = alignDown(Math.min(start, usableEnd), MIB);
		if (gapEnd >= gapStart + MIB) gaps.push({ start: gapStart, size: gapEnd - gapStart });
		cursor = Math.max(cursor, end);
	}
	return gaps;
}

export function editOf(edits: Edits, number: number): Assignment & { edit: ExistingEdit } {
	return edits.existing[number] ?? { edit: { op: "keep" }, role: null, mountpoint: null };
}

/** The disk as `edits` would leave it. */
export function project(inspect: InspectResult, edits: Edits): Projection {
	const sector = Math.max(512, inspect.disk.logical_sector_bytes);
	const [usableStart, usableEnd] = edits.newTable
		? [MIB, inspect.disk.size_bytes - (Math.ceil(GPT_ENTRIES_BYTES / sector) + 1) * sector]
		: [inspect.usable_start_bytes, inspect.usable_end_bytes];

	const erased: PartitionInfo[] = [];
	const kept: Segment[] = [];
	for (const part of inspect.partitions) {
		const { edit, role, mountpoint } = editOf(edits, part.number);
		if (edits.newTable || edit.op === "delete") {
			erased.push(part);
			continue;
		}
		kept.push({
			kind: "existing",
			part,
			edit,
			role,
			mountpoint,
			start: part.start_bytes,
			size: edit.op === "resize" ? edit.sizeMb * MIB : part.size_bytes,
		});
	}

	let gaps = freeGaps(
		usableStart,
		usableEnd,
		kept.map((s) => [s.start, s.start + s.size]),
	);
	const placed: Segment[] = [];
	for (const part of edits.created) {
		const start = part.startMb * MIB;
		const index = gaps.findIndex((g) => g.start <= start && start < g.start + g.size);
		const gap = gaps[index];
		const size =
			part.sizeMb === null ? (gap ? gap.start + gap.size - start : 0) : part.sizeMb * MIB;
		if (!gap || start + size > gap.start + gap.size) {
			placed.push({
				kind: "new",
				part,
				role: part.role,
				mountpoint: part.mountpoint,
				start,
				size,
				fits: false,
			});
			continue;
		}
		const rest: Array<{ start: number; size: number }> = [];
		if (start >= gap.start + MIB) rest.push({ start: gap.start, size: start - gap.start });
		const gapEnd = gap.start + gap.size;
		if (gapEnd >= start + size + MIB)
			rest.push({ start: start + size, size: gapEnd - start - size });
		gaps = [...gaps.slice(0, index), ...rest, ...gaps.slice(index + 1)];
		placed.push({
			kind: "new",
			part,
			role: part.role,
			mountpoint: part.mountpoint,
			start,
			size,
			fits: true,
		});
	}

	const segments = [
		...kept,
		...placed,
		...gaps.map((g): Segment => ({ kind: "free", start: g.start, size: g.size })),
	].sort((a, b) => a.start - b.start);
	return { segments, erased, usableStart, usableEnd };
}

/** The free space right after `segment`, which a resize can grow into. */
export function spaceAfter(projection: Projection, segment: Segment): number {
	const index = projection.segments.indexOf(segment);
	const next = projection.segments[index + 1];
	return next?.kind === "free" ? next.size : 0;
}

/** The explicit layout recpart plans from (`recpart plan --layout`). */
export function toLayout(inspect: InspectResult, edits: Edits): ManualLayout {
	const actions: LayoutAction[] = [];
	for (const part of inspect.partitions) {
		const entry = edits.existing[part.number];
		if (edits.newTable || !entry) continue;
		const { edit, role, mountpoint } = entry;
		if (edit.op === "delete") actions.push({ action: "delete", partition: part.number });
		else if (edit.op === "resize")
			actions.push({
				action: "resize",
				partition: part.number,
				size_mb: edit.sizeMb,
				role,
				mountpoint,
			});
		else if (edit.op === "format")
			actions.push({
				action: "format",
				partition: part.number,
				filesystem: edit.filesystem,
				label: edit.label,
				role,
				mountpoint,
			});
		else if (role) actions.push({ action: "keep", partition: part.number, role, mountpoint });
	}
	for (const part of edits.created) {
		actions.push({
			action: "create",
			size_mb: part.sizeMb,
			start_mb: part.startMb,
			filesystem: part.filesystem,
			label: part.label,
			role: part.role,
			mountpoint: part.mountpoint,
		});
	}
	return {
		new_table: edits.newTable,
		// The plan refuses a disk whose table changed since it was inspected.
		table_id: edits.newTable ? null : inspect.table_id,
		actions,
		swap_file: null,
	};
}

/** The roles `mode` needs, in the order the checklist shows them. */
export function requiredRoles(mode: InstallMode): readonly Role[] {
	return mode === "ab" ? ["efi", "root_a", "root_b", "state"] : ["efi", "root"];
}

/** The roles a partition can take in `mode` (`root` belongs to mutable, the slots to A/B). */
export function rolesFor(mode: InstallMode): readonly Role[] {
	return mode === "ab"
		? ["efi", "root_a", "root_b", "state", "home", "swap", "other"]
		: ["efi", "root", "state", "home", "swap", "other"];
}

/** recpart formats roots and state whatever they held, so those roles erase a partition. */
export function roleFormats(role: Role | null): boolean {
	return role === "root" || role === "root_a" || role === "root_b" || role === "state";
}

/** The filesystem a role gets when recpart formats for it. */
export function roleFilesystem(role: Role | null): Filesystem {
	return role === "efi" ? "vfat" : role === "swap" ? "swap" : "ext4";
}

/** A size typed into the editor: `20G`, `512M`, `1.5T`, `50%` (of `percentOf`), or
 * `rest`/empty (the most there is). A bare number is GiB. */
export function parseSize(
	text: string,
	percentOf: number,
): { kind: "rest" } | { kind: "mb"; mb: number } | { kind: "invalid" } {
	const t = text.trim().toLowerCase();
	if (t === "" || t === "rest" || t === "max") return { kind: "rest" };
	const percent = /^(\d+(?:\.\d+)?)\s*%$/.exec(t);
	if (percent) {
		const mb = Math.floor((percentOf * Number(percent[1])) / 100 / MIB);
		return mb > 0 ? { kind: "mb", mb } : { kind: "invalid" };
	}
	const sized = /^(\d+(?:\.\d+)?)\s*(m|mb|mib|g|gb|gib|t|tb|tib)?$/.exec(t);
	if (!sized) return { kind: "invalid" };
	const unit = (sized[2] ?? "g")[0];
	const mb = Math.floor(Number(sized[1]) * (unit === "m" ? 1 : unit === "g" ? 1024 : 1024 * 1024));
	return mb > 0 ? { kind: "mb", mb } : { kind: "invalid" };
}
