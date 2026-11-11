/**
 * What recab reports, put in words: the machine's A/B state as one headline, each slot's
 * part in it, and recab's errors with what to do about them.
 */
import { readFileSync } from "node:fs";
import { osReleaseFact } from "@levitate/docs-content/distros";
import type { ColorIntent, CommandResult, Tone } from "@levitate/tui-kit";
import { SLOTS, type Slot, type Status } from "../generated/recab";

/**
 * Read `recab status --json`. recab prints it from the Rust type the
 * contract is generated from, so only its shape is confirmed here.
 */
export function parseRecabStatusJson(input: string): Status | null {
	try {
		const value = JSON.parse(input) as Partial<Status> | null;
		return value &&
			value.schema_version === 10 &&
			Array.isArray(value.operations) &&
			value.lifecycle &&
			SLOTS.includes(value.active_slot as Slot)
			? (value as Status)
			: null;
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
	const labels: Record<string, string> = {
		stable: `Running slot ${s.active_slot}, committed`,
		open: "Prepared system accepts changes",
		working: "recab is working",
		interrupted: "An operation needs recovery",
		conflicted: "Resolve release conflicts",
		ready: "Prepared system is finalized",
		restart_set: `Slot ${s.next_boot} boots once on the next reboot`,
		on_trial: `Running slot ${s.active_slot} on trial: not committed`,
		trial_failed: "The prepared generation failed its trial",
		unusable: "System recovery is required",
	};
	return {
		tone: s.recovery_reason ? "warning" : "info",
		title: labels[s.lifecycle.state] ?? s.lifecycle.state,
		lines: [s.recovery_reason ?? `The other system is ${s.lifecycle.other}.`],
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
	if (s.lifecycle.trial_current && trial?.slot === slot)
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
const ERROR_HELP: Record<number, string | (() => string)> = {
	13: () => {
		const tool = privilegeTool();
		return `Run recab-tui as root${tool ? ` (with ${tool})` : ""}: changes write EFI variables and the ESP.`;
	},
	20: "recab needs access to the UEFI boot backend. Read the reported reason before retrying.",
	22: "The change stopped part way. Check the slots before rebooting; recab never selects a slot that can't boot.",
	23: "Trial assessment or recovery needs attention. Read the message to see whether a reboot was requested.",
};

/** The running system's privilege tool, from its os-release profile; null when it declares none. */
export function privilegeTool(osRelease = "/etc/os-release"): string | null {
	try {
		return osReleaseFact(readFileSync(osRelease, "utf8"), "privilege");
	} catch {
		return null;
	}
}

export type RecabError = {
	/** recab's class, as `RECAB_ERR_STATE`, when it printed one. */
	tag: string | null;
	/** recab's message, without its `recab:` prefix and class. */
	message: string;
	/** What to do, from the exit code. */
	help: string | null;
};

function helpFor(code: number): string | null {
	const help = ERROR_HELP[code];
	return typeof help === "function" ? help() : (help ?? null);
}

/** recab's error from a failed run: `recab: [RECAB_ERR_…] message` on stderr. */
export function recabError(result: CommandResult): RecabError {
	const text = (result.stderr.trim() || result.stdout.trim()).replace(/^recab:\s*/, "");
	for (const line of text.split("\n").reverse()) {
		try {
			const e = JSON.parse(line);
			if (e.message && ("class" in e || e.event === "failed"))
				return { tag: e.class ?? null, message: e.message, help: helpFor(result.exitCode ?? 1) };
		} catch {}
	}
	try {
		const e = JSON.parse(text);
		if (e.message)
			return { tag: e.class ?? null, message: e.message, help: helpFor(result.exitCode ?? 1) };
	} catch {}
	const tag = /\[(RECAB_ERR_[A-Z_]+)\]\s*/.exec(text);
	return {
		tag: tag?.[1] ?? null,
		message: (tag ? text.replace(tag[0], "") : text) || "(no output)",
		help:
			result.exitCode === null
				? "recab didn't start: is it installed and on PATH?"
				: helpFor(result.exitCode),
	};
}

export type SlotBlock = {
	slot: string;
	/** The bar's colour: the running slot, the one booting next as a trial, or neither. */
	state: "running" | "next" | "idle";
	/** Written at the bar's end. */
	tag: string;
	/** What it is to the machine. */
	role: string;
	/** Its standing in the boot order and its last trial. */
	standing: SlotTag;
	/** The partition it lives on, when recab found it. */
	device: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A local date as `5 Nov`. */
export function formatDay(unixSeconds: number): string {
	const d = new Date(unixSeconds * 1000);
	return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** One slot as the page draws it: a bar in its state, what it is, and where it stands. */
export function slotBlock(s: Status, slot: Slot): SlotBlock {
	const view = (s.slots ?? []).find((v) => v.slot === slot);
	const running = s.active_slot === slot;
	const next = !running && s.trial_pending && s.next_boot === slot;
	const trial = s.lifecycle.trial_current && s.last_trial?.slot === slot ? s.last_trial : null;
	const parts: SlotTag[] = [];
	if (view && !view.generation_ready)
		parts.push({
			text:
				view.readiness === "incomplete" ? "preparation not finalized" : "generation not bootable",
			intent: "warning",
		});
	if (trial)
		parts.push(
			trial.committed
				? { text: "last trial kept", intent: "success" }
				: { text: `last trial failed, ${formatDay(trial.unix_time)}`, intent: "error" },
		);
	if (running && !s.committed) parts.push({ text: "not committed", intent: "warning" });
	else if (s.known_good_slot === slot) parts.push({ text: "known-good", intent: "info" });
	else if (!trial) parts.push({ text: "not known-good", intent: "dimText" });
	if (s.default_slot === slot && s.known_good_slot !== slot)
		parts.push({ text: "boots by default", intent: "warning" });
	const worst =
		parts.find((p) => p.intent === "error") ??
		parts.find((p) => p.intent === "warning") ??
		parts.find((p) => p.intent === "info") ??
		parts[0]!;
	return {
		slot,
		state: running ? "running" : next ? "next" : "idle",
		tag: running ? "running" : next ? "next boot" : "",
		role: running
			? "this system"
			: next
				? "on trial"
				: s.rollback_slot === slot
					? "the previous system"
					: "not running",
		standing: { text: parts.map((p) => p.text).join(", "), intent: worst.intent },
		device: view?.device ?? null,
	};
}
