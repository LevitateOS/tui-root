/**
 * What recab reports, put in words: the machine's A/B state as one headline, each slot's
 * part in it, and recab's errors with what to do about them.
 */
import type { ColorIntent, CommandResult, Tone } from "@levitate/tui-kit";
import { SLOTS, type Slot, type Status } from "../generated/recab";

/**
 * Read `recab status --json`. recab prints it from the Rust type the
 * contract is generated from, so only its shape is confirmed here.
 */
export function parseRecabStatusJson(input: string): Status | null {
	try {
		const value = JSON.parse(input) as Partial<Status> | null;
		return value && SLOTS.includes(value.active_slot as Slot) ? (value as Status) : null;
	} catch {
		return null;
	}
}

export function slotName(value: Slot | null): string {
	return value ? `slot ${value}` : "none";
}

/** A local date and time to the minute, as `2026-11-06 14:13`. */
export function formatTime(unixSeconds: number): string {
	const d = new Date(unixSeconds * 1000);
	const two = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export type Headline = { tone: Tone; title: string; lines: string[] };

/** The machine's A/B state in one sentence, and what follows from it. */
export function headline(s: Status): Headline {
	const good = s.known_good_slot;
	if (s.trial_pending && s.next_boot)
		return {
			tone: "info",
			title: `Slot ${s.next_boot} boots once on the next reboot`,
			lines: [
				`If slot ${s.next_boot} starts healthy, recab commits it and it becomes the default.`,
				good
					? `If it fails, the machine reboots into slot ${good}, the known-good slot.`
					: "No known-good slot is recorded to fall back to.",
			],
		};
	if (!s.committed)
		return {
			tone: "warning",
			title: `Running slot ${s.active_slot} on trial: not committed`,
			lines: [
				`The trial service commits slot ${s.active_slot} once startup is healthy (Commit does it by hand).`,
				good
					? `Rebooting before then returns to slot ${good}.`
					: "No known-good slot is recorded to return to.",
			],
		};
	if (s.default_slot !== good)
		return {
			tone: "warning",
			title: "The default isn't the known-good slot",
			lines: [
				`${slotName(s.default_slot)} boots by default, but ${slotName(good)} is known-good.`,
				`Commit makes slot ${s.active_slot} both, so a failed trial falls back to it.`,
			],
		};
	return {
		tone: "success",
		title: `Running slot ${s.active_slot}, committed`,
		lines: [
			`Slot ${s.active_slot} is known-good and boots by default.`,
			s.rollback_slot
				? `Slot ${s.rollback_slot} still holds the previous system: Roll back returns to it.`
				: `Slot ${s.inactive_slot} holds no system to roll back to; Write a system puts an update there.`,
		],
	};
}

export type SlotTag = { text: string; intent: ColorIntent };

/** What a slot is to the machine now, most important first. */
export function slotTags(s: Status, slot: Slot): SlotTag[] {
	const tags: SlotTag[] = [];
	if (s.active_slot === slot)
		tags.push(
			s.committed
				? { text: "running, committed", intent: "success" }
				: { text: "running, not committed", intent: "warning" },
		);
	else tags.push({ text: "not running", intent: "dimText" });
	if (s.known_good_slot === slot) tags.push({ text: "known-good", intent: "success" });
	if (s.default_slot === slot) tags.push({ text: "boots by default", intent: "text" });
	if (s.next_boot === slot)
		tags.push(
			s.trial_pending
				? { text: "next boot, as a trial", intent: "warning" }
				: { text: "next boot", intent: "accent" },
		);
	if (s.rollback_slot === slot && s.active_slot !== slot)
		tags.push({ text: "roll back target", intent: "info" });
	const trial = s.last_trial;
	if (trial?.slot === slot)
		tags.push(
			trial.committed
				? { text: "last trial: kept", intent: "success" }
				: { text: "last trial: failed", intent: "error" },
		);
	return tags;
}

/** The boot sequence from here: what boots next, after that, and on a failure. */
export function bootOrder(s: Status): Array<[string, string]> {
	const rows: Array<[string, string]> = [["Running now", `slot ${s.active_slot}`]];
	if (s.trial_pending && s.next_boot) {
		rows.push(["Next boot", `slot ${s.next_boot}, once, as a trial`]);
		rows.push(["If it's healthy", `slot ${s.next_boot} is committed and stays`]);
		rows.push(["If it fails", `back to ${slotName(s.known_good_slot)}`]);
	} else {
		rows.push(["Next boot", slotName(s.next_boot)]);
		if (!s.committed) rows.push(["If startup fails", `back to ${slotName(s.known_good_slot)}`]);
	}
	rows.push(["Roll back to", slotName(s.rollback_slot)]);
	return rows;
}

/** What to do, by exit code, where recab's own message doesn't say it. Code 21 (refused,
 * or the layout unreadable) has none: recab's message names the reason and the fix. */
const ERROR_HELP: Record<number, string> = {
	13: "Run recab-tui as root (doas or sudo): changes write EFI variables and the ESP.",
	20: "recab needs UEFI with efivarfs (/sys/firmware/efi/efivars); writing a system also needs blkid, mkfs.ext4, mount and recstrap.",
	22: "The change stopped part way. Check the slots before rebooting; recab never selects a slot that can't boot.",
	23: "The trial boot wasn't healthy and wasn't committed; the machine returns to the known-good slot.",
};

export type RecabError = {
	/** recab's class, as `RECAB_ERR_STATE`, when it printed one. */
	tag: string | null;
	/** recab's message, without its `recab:` prefix and class. */
	message: string;
	/** What to do, from the exit code. */
	help: string | null;
};

/** recab's error from a failed run: `recab: [RECAB_ERR_…] message` on stderr. */
export function recabError(result: CommandResult): RecabError {
	const text = (result.stderr.trim() || result.stdout.trim()).replace(/^recab:\s*/, "");
	const tag = /\[(RECAB_ERR_[A-Z_]+)\]\s*/.exec(text);
	return {
		tag: tag?.[1] ?? null,
		message: (tag ? text.replace(tag[0], "") : text) || "(no output)",
		help:
			result.exitCode === null
				? "recab didn't start: is it installed and on PATH?"
				: (ERROR_HELP[result.exitCode] ?? null),
	};
}
