/**
 * disk-plan's state machine: the page, the choices, what is typed on Confirm, the one
 * apply, and which round of recpart reads is current. Every change goes through
 * `step`; the screen dispatches events and draws what it returns. The recpart reads
 * (disk list, inspect, plan, dry run) run outside it, keyed by their arguments and
 * `reads`, so `refresh` runs all of them again and a stale result is never shown.
 */
import { CONFIRM_TOKEN, type ApplyResult, type InstallMode } from "./generated/recpart";
import type { Saved } from "./app/install-state";
import { lastFailure, page, type Method, type PageId, type Run, type Session } from "./flow";

/** recpart's code for an apply refused because the disk no longer gives the confirmed
 * plan; it is checked before anything is written. */
export const DISK_CHANGED = "E023";

export type Machine = {
	page: PageId;
	/** The failure view is over the page. */
	failureShown: boolean;
	notice: string | null;
	mode: InstallMode;
	method: Method;
	/** What is typed on Confirm, and the plan document it confirms: it counts only for
	 * that plan, so a changed plan has to be confirmed again. */
	token: { text: string; plan: string | null };
	apply: Run<ApplyResult>;
	saved: Saved | null;
	/** The round of recpart reads; `refresh` starts the next. */
	reads: number;
};

export type Event =
	| { type: "next"; session: Session }
	| { type: "back"; session: Session }
	| { type: "toggle-failure"; session: Session }
	| { type: "mode"; mode: InstallMode }
	| { type: "method"; method: Method }
	| { type: "type"; text: string; plan: string | null }
	| { type: "erase"; plan: string | null }
	| { type: "apply-started"; argv: readonly string[] }
	| { type: "apply-finished"; run: Run<ApplyResult>; saved: Saved | null }
	| { type: "refresh" }
	| { type: "notice"; text: string | null };

export function start(mode: InstallMode): Machine {
	return {
		page: "welcome",
		failureShown: false,
		notice: null,
		mode,
		method: "erase",
		token: { text: "", plan: null },
		apply: { kind: "idle" },
		saved: null,
		reads: 0,
	};
}

/** The text typed on Confirm, if it was typed for `plan`. */
export function tokenFor(machine: Machine, plan: string | null): string {
	return machine.token.plan === plan ? machine.token.text : "";
}

/** The apply failed before writing anything because the disk changed: it can be read
 * again and confirmed anew. */
export function diskChanged(apply: Run<ApplyResult>): boolean {
	return apply.kind === "failed" && apply.error?.code === DISK_CHANGED;
}

function go(machine: Machine, id: PageId | null): Machine {
	return id === null ? machine : { ...machine, page: id, notice: null };
}

export function step(machine: Machine, event: Event): Machine {
	switch (event.type) {
		case "next": {
			const current = page(machine.page);
			if (current.gate && !current.gate.holds(event.session))
				return { ...machine, notice: `to continue, ${current.gate.rule}` };
			return go(machine, current.next(event.session));
		}
		case "back":
			return machine.failureShown
				? { ...machine, failureShown: false }
				: go(machine, page(machine.page).back(event.session));
		case "toggle-failure":
			return lastFailure(event.session)
				? { ...machine, failureShown: !machine.failureShown }
				: { ...machine, notice: "nothing has failed" };
		case "mode":
			return { ...machine, mode: event.mode };
		case "method":
			return { ...machine, method: event.method };
		case "type": {
			const typed = machine.token.plan === event.plan ? machine.token.text : "";
			return {
				...machine,
				token: { text: (typed + event.text).slice(0, CONFIRM_TOKEN.length), plan: event.plan },
			};
		}
		case "erase":
			return {
				...machine,
				token: { text: tokenFor(machine, event.plan).slice(0, -1), plan: event.plan },
			};
		case "apply-started":
			// One apply per session: the disk no longer matches anything reviewed after it.
			if (machine.apply.kind !== "idle") return machine;
			return { ...go(machine, "apply-progress"), apply: { kind: "running", argv: event.argv } };
		case "apply-finished":
			return { ...machine, apply: event.run, saved: event.saved };
		case "refresh": {
			if (machine.apply.kind === "running")
				return { ...machine, notice: "recpart apply is running; it reads the disk itself" };
			const reads = machine.reads + 1;
			// A refused apply wrote nothing: start over from the disk, with every read new.
			if (diskChanged(machine.apply))
				return {
					...machine,
					reads,
					apply: { kind: "idle" },
					failureShown: false,
					page: "target-disk",
					token: { text: "", plan: null },
					notice: "the disk changed: check the disk, then review the plan again",
				};
			// After an apply the disk is no longer the reviewed one; reading it again only
			// refreshes what the pages show.
			return { ...machine, reads, notice: "read the disks again" };
		}
		case "notice":
			return { ...machine, notice: event.text };
	}
}
