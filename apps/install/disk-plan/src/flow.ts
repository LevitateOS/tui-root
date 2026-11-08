import {
	CONFIRM_TOKEN,
	type ApplyResult,
	type DiskInventory,
	type ErrorPayload,
	type InspectResult,
	type InstallMode,
	type ManualLayout,
	type PartitionPlan,
} from "./generated/recpart";
import { keyFor } from "@levitate/tui-kit";
import { CONFIRM_KEYS } from "./presentation/keymap";

/** A disk recpart listed, or a `--disk` it did not list (kept so the choice never silently moves). */
export type DiskChoice =
	| { kind: "listed"; disk: DiskInventory }
	| { kind: "unlisted"; path: string };

export function diskPath(choice: DiskChoice): string {
	return choice.kind === "listed" ? choice.disk.path : choice.path;
}

/** A recpart run as the flow sees it: what ran, and its document or why there is none. */
export type Run<T> =
	| { kind: "idle" }
	| { kind: "running"; argv: readonly string[] }
	| { kind: "ok"; argv: readonly string[]; value: T }
	| {
			kind: "failed";
			argv: readonly string[];
			exitCode: number | null;
			output: string;
			error: ErrorPayload | null;
	  };

/** How the layout is made: recpart's template over the whole disk, or edits to what is on it. */
export type Method = "erase" | "edit";

export const METHODS: readonly Method[] = ["erase", "edit"];

/** Everything the pages and gates read. */
export type Session = {
	disk: DiskChoice | null;
	mode: InstallMode;
	method: Method;
	/** `recpart inspect` of the disk: what is on it, and the editor's starting point. */
	inspect: Run<InspectResult>;
	/** The editor's layout (edit only). */
	layout: ManualLayout | null;
	/** The template's plan, or the editor's layout planned (recpart's check of it). */
	plan: Run<PartitionPlan>;
	/** One `apply --dry-run`; the command preview and the preflight both read it. */
	dryRun: Run<ApplyResult>;
	apply: Run<ApplyResult>;
	token: string;
};

/** Dry-run warnings are what a real apply would refuse (see the generated `ApplyResult.warnings`). */
export function refusals(session: Session): readonly string[] {
	return session.dryRun.kind === "ok" ? session.dryRun.value.warnings : [];
}

/** The one rule for starting the destructive apply. */
export function canApply(session: Session): boolean {
	return (
		session.disk !== null &&
		session.plan.kind === "ok" &&
		session.dryRun.kind === "ok" &&
		refusals(session).length === 0 &&
		session.token === CONFIRM_TOKEN &&
		session.apply.kind === "idle"
	);
}

/** The run that failed most recently in flow order, if any (re-running it clears this). */
export function lastFailure(
	session: Session,
):
	| { step: "plan" | "dry-run" | "apply"; run: Extract<Run<unknown>, { kind: "failed" }> }
	| { step: "preflight"; refusals: readonly string[] }
	| null {
	if (session.apply.kind === "failed") return { step: "apply", run: session.apply };
	if (session.dryRun.kind === "failed") return { step: "dry-run", run: session.dryRun };
	// The editor shows recpart's refusals of a layout as it is being made; they aren't failures.
	const refusedLayout =
		session.method === "edit" && session.plan.kind === "failed" && session.plan.error;
	if (session.plan.kind === "failed" && !refusedLayout) return { step: "plan", run: session.plan };
	if (refusals(session).length > 0) return { step: "preflight", refusals: refusals(session) };
	return null;
}

export type PageId =
	| "welcome"
	| "target-disk"
	| "system"
	| "disk-use"
	| "partitions"
	| "plan-preview"
	| "command-preview"
	| "preflight-checks"
	| "destructive-confirm"
	| "apply-progress"
	| "result-handoff"
	| "failure-diagnostics";

/** The stages the steps are grouped in on the rail. */
export type Phase = "Choose" | "Review" | "Apply";

export type Page = {
	id: PageId;
	/** What the page is called on screen. */
	title: string;
	/** The rail's group; pages without one (the failure view) aren't on the rail. */
	phase?: Phase;
	/** Has keys of its own, so the content pane can take focus. */
	interactive: boolean;
	/** Whether the flow goes through this page (default: always). */
	shown?: (session: Session) => boolean;
	/** What must hold to move on, shown on the welcome page as the safety rules. */
	gate?: { rule: string; holds: (session: Session) => boolean };
	next: (session: Session) => PageId | null;
	back: (session: Session) => PageId | null;
};

/** The flow: each page, its gate, and where Next and Back lead. */
export const PAGES: readonly Page[] = [
	{
		id: "welcome",
		title: "Overview",
		interactive: false,
		next: () => "target-disk",
		back: () => null,
	},
	{
		id: "target-disk",
		title: "Disk",
		phase: "Choose",
		interactive: true,
		gate: { rule: "a disk is chosen", holds: (s) => s.disk !== null },
		next: () => "system",
		back: () => "welcome",
	},
	{
		id: "system",
		title: "System",
		phase: "Choose",
		interactive: true,
		next: () => "disk-use",
		back: () => "target-disk",
	},
	{
		id: "disk-use",
		title: "Disk use",
		phase: "Choose",
		interactive: true,
		next: (s) => (s.method === "edit" ? "partitions" : "plan-preview"),
		back: () => "system",
	},
	{
		id: "partitions",
		title: "Partitions",
		phase: "Choose",
		interactive: true,
		shown: (s) => s.method === "edit",
		gate: { rule: "recpart accepts the layout", holds: (s) => s.plan.kind === "ok" },
		next: () => "plan-preview",
		back: () => "disk-use",
	},
	{
		id: "plan-preview",
		title: "Plan",
		phase: "Review",
		interactive: false,
		gate: { rule: "recpart produced a plan", holds: (s) => s.plan.kind === "ok" },
		next: () => "command-preview",
		back: (s) => (s.method === "edit" ? "partitions" : "disk-use"),
	},
	{
		id: "command-preview",
		title: "Commands",
		phase: "Review",
		interactive: false,
		gate: { rule: "the dry run succeeded", holds: (s) => s.dryRun.kind === "ok" },
		next: () => "preflight-checks",
		back: () => "plan-preview",
	},
	{
		id: "preflight-checks",
		title: "Checks",
		phase: "Review",
		interactive: false,
		gate: {
			rule: "recpart would not refuse the disk",
			holds: (s) => s.dryRun.kind === "ok" && refusals(s).length === 0,
		},
		next: () => "destructive-confirm",
		back: () => "command-preview",
	},
	{
		id: "destructive-confirm",
		title: "Confirm",
		phase: "Apply",
		interactive: true,
		gate: {
			rule: `${CONFIRM_TOKEN} is typed, then ${keyFor(CONFIRM_KEYS, "apply")} starts the apply`,
			holds: canApply,
		},
		// Only the apply action leaves this page forwards.
		next: () => null,
		back: () => "preflight-checks",
	},
	{
		id: "apply-progress",
		title: "Apply",
		phase: "Apply",
		interactive: false,
		next: (s) =>
			s.apply.kind === "ok"
				? "result-handoff"
				: s.apply.kind === "failed"
					? "failure-diagnostics"
					: null,
		// After an apply the disk no longer matches the reviewed plan; there is no way back to it.
		back: () => null,
	},
	{
		id: "result-handoff",
		title: "Done",
		phase: "Apply",
		interactive: false,
		next: () => null,
		back: () => "apply-progress",
	},
	{
		id: "failure-diagnostics",
		title: "Failure",
		interactive: false,
		next: () => null,
		back: () => "apply-progress",
	},
];

export function page(id: PageId): Page {
	return PAGES.find((p) => p.id === id)!;
}

/** The pages the flow goes through for this session, in order. */
export function shownPages(session: Session): Page[] {
	return PAGES.filter((p) => !p.shown || p.shown(session));
}

export type StepState = "done" | "current" | "failed" | "pending";

/** How the rail marks a page: where the run failed, the page you're on, a page behind you
 * whose gate holds, or one still ahead. */
export function stepState(id: PageId, current: PageId, session: Session): StepState {
	const failure = lastFailure(session);
	const failedAt: Record<string, PageId> = {
		plan: session.method === "edit" ? "partitions" : "plan-preview",
		"dry-run": "command-preview",
		preflight: "preflight-checks",
		apply: "apply-progress",
	};
	if (failure && failedAt[failure.step] === id) return "failed";
	if (id === current) return "current";
	const behind = position(id) < position(current);
	const target = page(id);
	return behind && (!target.gate || target.gate.holds(session) || id === "destructive-confirm")
		? "done"
		: "pending";
}

export function position(id: PageId): number {
	return PAGES.findIndex((p) => p.id === id);
}
