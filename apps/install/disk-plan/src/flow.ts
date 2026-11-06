import {
	CONFIRM_TOKEN,
	type ApplyResult,
	type DiskInventory,
	type ErrorPayload,
	type InstallMode,
	type PartitionPlan,
} from "./generated/recpart";

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

/** Everything the pages and gates read. */
export type Session = {
	disk: DiskChoice | null;
	mode: InstallMode;
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
	if (session.plan.kind === "failed") return { step: "plan", run: session.plan };
	if (refusals(session).length > 0) return { step: "preflight", refusals: refusals(session) };
	return null;
}

export type PageId =
	| "welcome"
	| "target-disk"
	| "mode-selection"
	| "plan-preview"
	| "command-preview"
	| "preflight-checks"
	| "destructive-confirm"
	| "apply-progress"
	| "result-handoff"
	| "failure-diagnostics";

export type Page = {
	id: PageId;
	/** Has keys of its own, so the content pane can take focus. */
	interactive: boolean;
	/** What must hold to move on, shown on the welcome page as the safety rules. */
	gate?: { rule: string; holds: (session: Session) => boolean };
	next: (session: Session) => PageId | null;
	back: (session: Session) => PageId | null;
};

/** The flow: each page, its gate, and where Next and Back lead. */
export const PAGES: readonly Page[] = [
	{ id: "welcome", interactive: false, next: () => "target-disk", back: () => null },
	{
		id: "target-disk",
		interactive: true,
		gate: { rule: "a disk is chosen", holds: (s) => s.disk !== null },
		next: () => "mode-selection",
		back: () => "welcome",
	},
	{
		id: "mode-selection",
		interactive: true,
		next: () => "plan-preview",
		back: () => "target-disk",
	},
	{
		id: "plan-preview",
		interactive: false,
		gate: { rule: "recpart produced a plan", holds: (s) => s.plan.kind === "ok" },
		next: () => "command-preview",
		back: () => "mode-selection",
	},
	{
		id: "command-preview",
		interactive: false,
		gate: { rule: "the dry run succeeded", holds: (s) => s.dryRun.kind === "ok" },
		next: () => "preflight-checks",
		back: () => "plan-preview",
	},
	{
		id: "preflight-checks",
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
		interactive: true,
		gate: { rule: `${CONFIRM_TOKEN} is typed, then Enter starts the apply`, holds: canApply },
		// Only the apply action leaves this page forwards.
		next: () => null,
		back: () => "preflight-checks",
	},
	{
		id: "apply-progress",
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
	{ id: "result-handoff", interactive: false, next: () => null, back: () => "apply-progress" },
	{
		id: "failure-diagnostics",
		interactive: false,
		next: () => null,
		back: () => "apply-progress",
	},
];

export function page(id: PageId): Page {
	return PAGES.find((p) => p.id === id)!;
}
