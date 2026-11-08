import type { Distro } from "@levitate/docs-content/distros";
import {
	installSteps as procedure,
	type GuideRef,
	type InstallStepId,
} from "@levitate/docs-content/install";
import type { InstallState, StepName, StepResults } from "@levitate/install-state";

/** What doing a step means, for the hub. */
export type Action =
	/** Start the step's app; it records its own result. */
	| { kind: "app"; argv: readonly string[]; label: string }
	/** Run the step's commands in the terminal; on success, record `step`. */
	| { kind: "run"; lines: readonly string[]; label: string; record?: Record_ }
	/** Record `step` now (nothing to run). */
	| { kind: "record"; label: string; record: Record_ }
	/** A shell with the step's commands to type; with `record`, the user marks the step done after. */
	| { kind: "shell"; lines: readonly string[]; label: string; record?: Record_ }
	/** Nothing to do yet, and why. */
	| { kind: "none"; why: string };

export type Record_ = { [S in StepName]: { step: S; result: StepResults[S] } }[StepName];

export type StepStatus = "done" | "current" | "blocked";

export interface Step {
	id: InstallStepId;
	title: string;
	/** One line on what the step does. */
	about: string;
	status: StepStatus;
	/** What it did, once done. */
	summary?: string;
	/** Checks or facts to show. */
	checks?: readonly { ok: boolean; label: string; fix?: string }[];
	action: Action;
	/** Where the guide beside the hub has the step in full. */
	guide: GuideRef;
}

const MODE_NAME = { ab: "A/B", mutable: "mutable" } as const;

/** What the hub records for a step that its own action completes. */
function recordFor(id: InstallStepId, state: InstallState): Record_ | undefined {
	const disk = state.steps.disk?.result;
	switch (id) {
		case "preflight":
			return { step: "preflight", result: { uefi: true, media: true } };
		case "setup":
			return { step: "setup", result: { manual: true } };
		case "boot":
			return disk ? { step: "boot", result: { mode: disk.mode } } : undefined;
		default:
			return undefined;
	}
}

function summary(id: InstallStepId, state: InstallState): string | undefined {
	const { disk, base, boot } = state.steps;
	switch (id) {
		case "disk":
			return disk
				? `${disk.result.disk}, ${MODE_NAME[disk.result.mode]}, at ${disk.result.target}`
				: undefined;
		case "base":
			if (!base) return undefined;
			return base.result.entries === null
				? `copied to ${base.result.target}`
				: `${base.result.entries.toLocaleString("en-US")} files copied to ${base.result.target}, fstab written`;
		case "setup":
			return state.steps.setup ? "marked done" : undefined;
		case "boot":
			return boot ? `boot entries written (${MODE_NAME[boot.result.mode]})` : undefined;
		default:
			return undefined;
	}
}

/**
 * Every install step of distro `d`, in order, with where the install stands. `exists`
 * answers the preflight checks (a path on the live system exists).
 */
export function installSteps(
	d: Distro,
	state: InstallState,
	exists: (path: string) => boolean,
): Step[] {
	const done = (id: InstallStepId) => id !== "finish" && state.steps[id] !== undefined;
	const steps = procedure(d, { disk: state.steps.disk?.result }).map(
		(step): Omit<Step, "status"> => {
			const record = recordFor(step.id, state);
			const base = {
				id: step.id,
				title: step.title,
				about: step.about,
				guide: step.guide,
				summary: summary(step.id, state),
			};
			const run = step.run;
			switch (run.kind) {
				case "checks": {
					const checks = run.checks.map((check) => ({
						ok: exists(check.path),
						label: check.label,
						fix: check.fix,
					}));
					return {
						...base,
						checks,
						action:
							checks.every((check) => check.ok) && record
								? { kind: "record", label: "continue", record }
								: { kind: "none", why: "Fix the failed checks first." },
					};
				}
				case "app":
					return {
						...base,
						action: {
							kind: "app",
							// The app ends by sending the user back here, not to a shell.
							argv: [...run.argv, "--then", "hub"],
							label: `open ${run.argv[0]}`,
						},
					};
				case "commands":
					return {
						...base,
						action: {
							kind: "run",
							label: step.id === "finish" ? "unmount and reboot" : "run this",
							lines: run.lines,
							record,
						},
					};
				case "type":
					return {
						...base,
						action: { kind: "shell", label: "open a shell for these", lines: run.lines, record },
					};
				case "unavailable":
					return { ...base, action: { kind: "none", why: run.why } };
			}
		},
	);
	const current = steps.findIndex((step) => !done(step.id));
	return steps.map((step, i) => ({
		...step,
		status: done(step.id) ? "done" : i === current ? "current" : "blocked",
	}));
}
