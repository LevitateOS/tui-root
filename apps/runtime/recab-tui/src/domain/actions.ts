/**
 * What each change would do to the slots, from recab's own rules (recab's `state::plan`):
 * whether recab would make it, refuse it, or find nothing to change, and the boot
 * selection before and after. recab still decides when it runs.
 */
import type { Action, ActionView, Slot, Status } from "../generated/recab";
import { slotName } from "./recab";

/** A slot in a table cell, whose row already says what it is. */
function cell(value: Slot | null): string {
	return value ?? "none";
}

export type ActionId = "try" | "commit" | "rollback" | "stage" | "reboot";

export const ACTION_IDS: readonly ActionId[] = ["try", "commit", "rollback", "stage", "reboot"];

/**
 * Whether the action takes the machine down: its run is not followed by reading the
 * status again, and quitting while it runs is allowed.
 */
export const TAKES_MACHINE_DOWN: Record<ActionId, boolean> = {
	try: false,
	commit: false,
	rollback: false,
	stage: false,
	reboot: true,
};

export type Verdict =
	| { kind: "ready" }
	| { kind: "no-change"; reason: string }
	| { kind: "refused"; reason: string };

export type Change = { what: string; before: string; after: string };

export type ActionPlan = {
	id: ActionId;
	/** Short, for the rail: "Try slot B". */
	label: string;
	/** The page's title. */
	title: string;
	/** What it does, in a sentence. */
	summary: string;
	verdict: Verdict;
	/** The boot selection before and after; rows that stay the same are kept, marked so. */
	changes: Change[];
	/** Formats a slot, so it asks for the slot's name, not just a yes. */
	destructive: boolean;
	/** The command it runs, or null when it needs answers first (stage). */
	argv: readonly string[] | null;
	/** What the action bar says before it runs. */
	bar: string;
	/** What success means, for the result page. */
	done: string;
	/** The change that usually follows, once this one is done. */
	followUp: ActionId | null;
};

const ready: Verdict = { kind: "ready" };

function row(what: string, before: string, after: string): Change {
	return { what, before, after };
}

/** The next boot, marked when it is a one-shot trial. */
function nextBoot(s: Status): string {
	return s.trial_pending ? `${cell(s.next_boot)}, once` : cell(s.next_boot);
}

function trial(s: Status): string {
	return s.trial_pending ? cell(s.next_boot) : "none";
}

/** The recab action each change runs; reboot is not recab's. */
const RECAB_ACTION: Partial<Record<ActionId, Action>> = {
	try: "set_next",
	commit: "commit",
	rollback: "rollback",
	stage: "stage",
};

/** What recab says it would make of `id`, when its status carries the verdicts. */
function recabView(id: ActionId, s: Status): ActionView | null {
	const action = RECAB_ACTION[id];
	return action ? ((s.actions ?? []).find((view) => view.action === action) ?? null) : null;
}

/** The boot selection recab says a change leaves, where it names one. */
function afterOf(view: ActionView): Record<string, string> | null {
	const after = view.after;
	if (!after) return null;
	return {
		"Next boot": after.trial_pending ? `${cell(after.next_boot)}, once` : cell(after.next_boot),
		"Trial pending": after.trial_pending ? cell(after.next_boot) : "none",
		Default: cell(after.default_slot),
		"Known-good": cell(after.known_good_slot),
		"Roll back to": cell(after.rollback_slot),
	};
}

/**
 * What `id` would do from `s`: recab's own verdict, reason and after-state when its
 * status carries them, else this file's copy of its rules.
 */
export function planAction(id: ActionId, s: Status): ActionPlan {
	const plan = localPlan(id, s);
	const view = recabView(id, s);
	if (!view) return plan;
	const reason =
		view.reason ?? (plan.verdict.kind === "ready" ? "recab gave no reason" : plan.verdict.reason);
	const verdict: Verdict =
		view.verdict === "ready"
			? ready
			: view.verdict === "no_change"
				? { kind: "no-change", reason }
				: { kind: "refused", reason };
	const after = afterOf(view);
	return {
		...plan,
		verdict,
		changes: after
			? plan.changes.map((change) =>
					change.what in after ? { ...change, after: after[change.what]! } : change,
				)
			: plan.changes,
	};
}

function localPlan(id: ActionId, s: Status): ActionPlan {
	const active = s.active_slot;
	const inactive = s.inactive_slot;
	switch (id) {
		case "try": {
			const fallback = s.known_good_slot ?? active;
			const verdict: Verdict =
				s.trial_pending && s.next_boot === inactive
					? { kind: "no-change", reason: `Slot ${inactive} already boots once on the next reboot.` }
					: s.default_slot !== fallback
						? {
								kind: "refused",
								reason: `The default (${slotName(s.default_slot)}) isn't the known-good slot (slot ${fallback}), so a failed trial wouldn't fall back to it. Commit first.`,
							}
						: ready;
			return {
				id,
				label: `Try slot ${inactive}`,
				title: `Try slot ${inactive} on the next boot`,
				summary: `Boot it once and see. If the trial fails, the machine comes back to slot ${fallback}.`,
				verdict,
				changes: [
					row("Next boot", nextBoot(s), `${inactive}, once`),
					row("Trial pending", trial(s), inactive),
					row("Default", cell(s.default_slot), cell(s.default_slot)),
					row("If the trial fails", "", fallback),
				],
				destructive: false,
				argv: ["recab", "set-next", inactive],
				bar: `Set slot ${inactive} for the next boot`,
				done: `Slot ${inactive} boots next, once. Reboot to start the trial.`,
				followUp: "reboot",
			};
		}
		case "commit": {
			const verdict: Verdict =
				s.committed && s.default_slot === active && !s.trial_pending
					? {
							kind: "no-change",
							reason: `Slot ${active} is already committed and boots by default.`,
						}
					: ready;
			const rollbackAfter =
				s.known_good_slot && s.known_good_slot !== active
					? s.known_good_slot
					: s.trial_pending
						? "unchanged"
						: cell(s.rollback_slot);
			return {
				id,
				label: `Commit slot ${active}`,
				title: `Commit slot ${active}`,
				summary: `Keep the running slot: make slot ${active} known-good and the default, and cancel any pending trial.`,
				verdict,
				changes: [
					row("Known-good", cell(s.known_good_slot), active),
					row("Default", cell(s.default_slot), active),
					row("Next boot", nextBoot(s), active),
					row("Trial pending", trial(s), "none"),
					row("Roll back to", cell(s.rollback_slot), rollbackAfter),
				],
				destructive: false,
				argv: ["recab", "commit"],
				bar: `Commit slot ${active}`,
				done: `Slot ${active} is committed: known-good and the default.`,
				followUp: null,
			};
		}
		case "rollback": {
			const target = s.rollback_slot;
			const cancelling = s.trial_pending;
			const verdict: Verdict = target
				? ready
				: {
						kind: "refused",
						reason: s.committed
							? `Slot ${active} is committed and no other slot has been known-good since it was written: there is nothing to roll back to.`
							: "No known-good slot is recorded and no default is set.",
					};
			const to = target ?? active;
			return {
				id,
				label: target ? `Roll back to ${target}` : "Roll back",
				title: target ? `Roll back to slot ${target}` : "Roll back",
				summary: cancelling
					? `Cancel the pending trial of slot ${s.next_boot}: the next boot stays on slot ${to}.`
					: !s.committed
						? `Give up on slot ${active}: the next boot returns to slot ${to}, the known-good slot.`
						: `Return to the previous system: slot ${to} becomes the default and known-good.`,
				verdict,
				changes: [
					row("Next boot", nextBoot(s), cell(target)),
					row("Default", cell(s.default_slot), cell(target)),
					row("Known-good", cell(s.known_good_slot), cell(target)),
					row("Trial pending", trial(s), "none"),
				],
				destructive: false,
				argv: ["recab", "rollback"],
				bar: target ? `Roll back to slot ${target}` : "Roll back",
				done: cancelling
					? "The trial is cancelled."
					: `Slot ${to} is the default. Reboot to start it.`,
				followUp: cancelling ? null : "reboot",
			};
		}
		case "stage": {
			const verdict: Verdict = !s.committed
				? {
						kind: "refused",
						reason: `Slot ${active} is running uncommitted, so slot ${inactive} is its only fallback. Commit slot ${active} or reboot into slot ${inactive} first.`,
					}
				: s.next_boot === inactive
					? {
							kind: "refused",
							reason: `Slot ${inactive} is the next boot. Roll back or commit first, so the next boot is slot ${active}.`,
						}
					: s.default_slot === inactive
						? {
								kind: "refused",
								reason: `Slot ${inactive} is the default. Commit slot ${active} first, so a new system in slot ${inactive} isn't booted untried.`,
							}
						: ready;
			return {
				id,
				label: `Write to slot ${inactive}`,
				title: `Write a new system to slot ${inactive}`,
				summary: `Erase slot ${inactive} and write a system into it. Accounts, network and services carry over.`,
				verdict,
				changes: [
					row(
						`Slot ${inactive}`,
						s.rollback_slot === inactive ? "previous system" : "what it holds",
						"new system",
					),
					row(
						"Roll back to",
						cell(s.rollback_slot),
						s.rollback_slot === inactive ? "none" : cell(s.rollback_slot),
					),
					row("Next boot", nextBoot(s), nextBoot(s)),
				],
				destructive: true,
				argv: null,
				bar: "Choose the system to write",
				done: `Slot ${inactive} holds the new system. Try slot ${inactive} to boot it once.`,
				followUp: "try",
			};
		}
		case "reboot": {
			const next = s.next_boot;
			return {
				id,
				label: "Reboot",
				title: "Reboot",
				summary: next
					? `Restart the machine into slot ${next}${s.trial_pending ? ", once, as a trial" : ""}.`
					: "Restart the machine.",
				verdict: ready,
				changes: [row("Boots", active, cell(next))],
				destructive: false,
				argv: ["reboot"],
				bar: s.trial_pending ? "Reboot into the trial" : "Reboot",
				done: "The machine is rebooting.",
				followUp: null,
			};
		}
	}
}

/** `recab stage` with the answers. */
export function stageArgv(answers: StageAnswers): string[] {
	return [
		"recab",
		"stage",
		"--rootfs",
		answers.rootfs,
		"--kernel",
		answers.kernel,
		...(answers.initrd ? ["--initrd", answers.initrd] : []),
	];
}

export type StageAnswers = { rootfs: string; kernel: string; initrd: string };

/** The status rows compared before and after a run. */
export const STATUS_ROWS: ReadonlyArray<[string, (s: Status) => string]> = [
	["Running", (s) => `${s.active_slot}, ${s.committed ? "committed" : "uncommitted"}`],
	["Next boot", nextBoot],
	["Default", (s) => cell(s.default_slot)],
	["Known-good", (s) => cell(s.known_good_slot)],
	["Roll back to", (s) => cell(s.rollback_slot)],
];
