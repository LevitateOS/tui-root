import { formatBytes } from "@levitate/tui-kit";
/**
 * The editor's guidance: plain names for roles, what the mode still needs, and the one
 * next step that gets there, including a quick setup that fills free space with the
 * mode's partitions. Sizes mirror recpart's policy (tools/recpart/src/policy.rs); recpart's
 * plan still decides whether a layout is valid.
 */
import type { InspectResult, InstallMode, PartitionInfo, Role } from "../generated/recpart";
import {
	MIB,
	project,
	requiredRoles,
	type Edits,
	type NewPartition,
	type Projection,
	type Segment,
} from "./layout";
import { shortDevice } from "@levitate/tui-kit";

const GIB_MB = 1024;
/** recpart's default A/B root slot, and the smallest it accepts. */
const AB_ROOT_MB = 20 * GIB_MB;
const MIN_AB_ROOT_MB = 8 * GIB_MB;
const MIN_STATE_MB = 4 * GIB_MB;
const MIN_MUTABLE_ROOT_MB = 8 * GIB_MB;
/** A new EFI partition: recpart's default size. */
const NEW_EFI_MB = 1024;
/** Room the mode's kernels and the boot loader take on the EFI partition. */
function efiFilesMb(mode: InstallMode): number {
	return (mode === "ab" ? 2 : 1) * 128 + 8;
}
const EFI_TYPE = "C12A7328-F81F-11D2-BA4B-00A0C93EC93B";

/** What a role is called on screen. */
export const ROLE_NAME: Record<Role, string> = {
	efi: "EFI partition",
	root: "System",
	root_a: "System slot A",
	root_b: "System slot B",
	state: "State (/var)",
	home: "Home (/home)",
	swap: "Swap",
	other: "Other mount point",
};

/** What a role is for, in a few words. */
export const ROLE_PURPOSE: Record<Role, string> = {
	efi: "boot loader and kernels, at /boot",
	root: "the system, at /",
	root_a: "the system you install now, at /",
	root_b: "the slot updates are written to",
	state: "data both slots share, at /var",
	home: "your files, at /home",
	swap: "memory overflow",
	other: "mounted where you say",
};

export function roleLabel(role: Role | null, mountpoint: string | null): string {
	if (!role) return "";
	return role === "other" ? (mountpoint ?? "other") : ROLE_NAME[role];
}

/** The least free space, in one place, the mode's new partitions need (MiB). */
export function neededMb(mode: InstallMode): number {
	return mode === "ab" ? 2 * MIN_AB_ROOT_MB + MIN_STATE_MB : MIN_MUTABLE_ROOT_MB;
}

export function isEfi(part: PartitionInfo): boolean {
	return part.type_guid.toUpperCase() === EFI_TYPE;
}

function holders(projection: Projection, role: Role): Segment[] {
	return projection.segments.filter((s) => s.kind !== "free" && s.role === role);
}

export function missingRoles(projection: Projection, mode: InstallMode): Role[] {
	return requiredRoles(mode).filter((role) => holders(projection, role).length === 0);
}

/** An existing EFI system partition with room for the mode's boot files. */
function reusableEfi(projection: Projection, mode: InstallMode): PartitionInfo | null {
	for (const s of projection.segments) {
		if (s.kind !== "existing" || s.role || s.edit.op !== "keep" || !isEfi(s.part)) continue;
		const free = s.part.used_bytes === null ? null : s.part.size_bytes - s.part.used_bytes;
		if (free === null || free >= efiFilesMb(mode) * MIB) return s.part;
	}
	return null;
}

function largestFree(projection: Projection): Extract<Segment, { kind: "free" }> | null {
	let best: Extract<Segment, { kind: "free" }> | null = null;
	for (const s of projection.segments)
		if (s.kind === "free" && (!best || s.size > best.size)) best = s;
	return best;
}

export type SetupStep = { what: string; detail: string };

export type Setup =
	| { kind: "ok"; edits: Edits; steps: SetupStep[]; freeMb: number }
	| { kind: "no-room"; freeMb: number; needMb: number };

/** The quick setup: the roles still missing, an existing EFI partition reused when there
 * is one, the rest made in the largest free space. */
export function quickSetup(
	inspect: InspectResult,
	edits: Edits,
	mode: InstallMode,
	/** The free space to use (its start, in bytes), instead of the largest. */
	at: number | null = null,
): Setup {
	let current = edits;
	let projection = project(inspect, current);
	const steps: SetupStep[] = [];
	const missing = missingRoles(projection, mode);
	if (missing.includes("efi")) {
		const efi = reusableEfi(projection, mode);
		if (efi) {
			current = {
				...current,
				existing: {
					...current.existing,
					[efi.number]: { edit: { op: "keep" }, role: "efi", mountpoint: null },
				},
			};
			steps.push({
				what: `${shortDevice(efi.device)} becomes the EFI partition`,
				detail: "kept as it is, so what boots from it now keeps booting",
			});
		}
	}
	projection = project(inspect, current);
	const chosen = projection.segments.find((s) => s.kind === "free" && s.start === at);
	const gap = chosen?.kind === "free" ? chosen : largestFree(projection);
	const freeMb = gap ? Math.floor(gap.size / MIB) : 0;
	const want = missingRoles(projection, mode);
	const efiMb = want.includes("efi") ? NEW_EFI_MB : 0;
	// A slot that is already there fixes the other slot's size.
	const slot = projection.segments.find(
		(s) => s.kind !== "free" && (s.role === "root_a" || s.role === "root_b"),
	);
	const fixedSlotMb = slot ? Math.floor(slot.size / MIB) : null;
	const sizes = new Map<Role, number | null>();
	if (want.includes("efi")) sizes.set("efi", NEW_EFI_MB);
	const room = freeMb - efiMb;
	if (mode === "ab") {
		const slots = (["root_a", "root_b"] as const).filter((r) => want.includes(r));
		const stateMin = want.includes("state") ? MIN_STATE_MB : 0;
		const each =
			fixedSlotMb ??
			Math.max(
				MIN_AB_ROOT_MB,
				Math.min(AB_ROOT_MB, Math.floor((room - stateMin) / Math.max(1, slots.length))),
			);
		for (const r of slots) sizes.set(r, each);
		// State takes the rest; without it to place, the last slot ends where the space does.
		if (want.includes("state")) sizes.set("state", null);
	} else if (want.includes("root")) sizes.set("root", null);
	const fixed = [...sizes.values()].reduce<number>((sum, mb) => sum + (mb ?? 0), 0);
	const restMin =
		(sizes.has("state") ? MIN_STATE_MB : 0) + (sizes.has("root") ? MIN_MUTABLE_ROOT_MB : 0);
	const needMb = fixed + restMin;
	if (sizes.size > 0 && (!gap || needMb > freeMb)) return { kind: "no-room", freeMb, needMb };

	let start = gap ? gap.start / MIB : 0;
	let nextId = current.nextId;
	const created: NewPartition[] = [];
	for (const role of ["efi", "root_a", "root_b", "root", "state"] as const) {
		if (!sizes.has(role)) continue;
		const sizeMb = sizes.get(role)!;
		created.push({
			id: nextId++,
			startMb: start,
			sizeMb,
			filesystem: null,
			label: null,
			role,
			mountpoint: null,
		});
		steps.push({
			what: `new ${ROLE_NAME[role]}`,
			detail:
				sizeMb === null
					? `${formatBytes((freeMb - fixed) * MIB)}, the rest of the free space`
					: formatBytes(sizeMb * MIB),
		});
		if (sizeMb !== null) start += sizeMb;
	}
	return {
		kind: "ok",
		edits: { ...current, created: [...current.created, ...created], nextId },
		steps,
		freeMb,
	};
}

/** The partition that would give the most room if shrunk, and how much. */
export function bestShrink(
	projection: Projection,
): { part: PartitionInfo; spareMb: number } | null {
	let best: { part: PartitionInfo; spareMb: number } | null = null;
	for (const s of projection.segments) {
		if (s.kind !== "existing" || s.edit.op !== "keep" || s.part.min_size_bytes === null) continue;
		const spareMb = Math.floor((s.part.size_bytes - s.part.min_size_bytes) / MIB);
		if (spareMb > 0 && (!best || spareMb > best.spareMb)) best = { part: s.part, spareMb };
	}
	return best;
}

/** What the editor sets up in the free space, for each mode ("set up A/B", "set up the system"). */
export const SETUP_NAME: Record<InstallMode, string> = { ab: "A/B", mutable: "the system" };
