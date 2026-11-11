import type { Distro } from "@levitate/docs-content/distros";
import { formatCount, shortDevice } from "@levitate/tui-kit";
import {
	installSteps as procedure,
	MODE_NAME,
	type GuideRef,
	type InstallStepId,
} from "@levitate/docs-content/install";
import type { InstallState, StepName, StepResults } from "@levitate/install-state";

/** What doing a step means, for the hub. */
export type Action =
	/** Start the step's app; it records its own result. `byHand` is what the hub records
	 * instead when the user did the step in the shell and marks it done. */
	| { kind: "app"; argv: readonly string[]; label: string; byHand?: Record_ }
	/** Run the step's commands in the terminal; on success, record `step`. */
	| { kind: "run"; lines: readonly string[]; label: string; record?: Record_ }
	/** Record `step` now (nothing to run). */
	| { kind: "record"; label: string; record: Record_ }
	/** A shell; the hub comes back when it exits. */
	| { kind: "shell"; label: string }
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
	/** When it finished, as the state file recorded it (ISO 8601). */
	doneAt?: string;
	/** Checks to show: what was looked for, where, and what to do when it is missing. */
	checks?: readonly { ok: boolean; label: string; path: string; fix?: string }[];
	action: Action;
	/** Where the guide beside the hub has the step in full. */
	guide: GuideRef;
}

/** What the hub records for a step that its own action completes, or (setup) that the
 * user did by hand. */
function recordFor(id: InstallStepId, state: InstallState): Record_ | undefined {
	const disk = state.steps.disk?.result;
	switch (id) {
		case "preflight":
			return { step: "preflight", result: { uefi: true, media: true } };
		case "setup":
			return { step: "setup", result: { manual: true, hostname: null, user: null } };
		case "boot":
			return disk ? { step: "boot", result: { mode: disk.mode } } : undefined;
		default:
			return undefined;
	}
}

/** What a finished step leaves, short enough for the end of its row in the rail. */
export function railValue(id: InstallStepId, state: InstallState): string {
	const { preflight, disk, base, setup, boot } = state.steps;
	switch (id) {
		case "preflight":
			return preflight ? "UEFI" : "";
		case "disk":
			return disk ? shortDevice(disk.result.disk) : "";
		case "base":
			return base ? "copied" : "";
		case "setup":
			return setup ? (setup.result.user ?? (setup.result.manual ? "by hand" : "set")) : "";
		case "boot":
			return boot ? MODE_NAME[boot.result.mode] : "";
		case "finish":
			return "";
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
				: `${formatCount(base.result.entries)} files copied to ${base.result.target}, fstab written`;
		case "setup": {
			const setup = state.steps.setup?.result;
			if (!setup) return undefined;
			if (setup.manual) return "marked done";
			return (
				[
					setup.hostname ? `hostname ${setup.hostname}` : null,
					setup.user ? `user ${setup.user}` : null,
				]
					.filter(Boolean)
					.join(", ") || "configured"
			);
		}
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
	const done = (id: InstallStepId) => {
		if (id === "finish") return false;
		const boot = state.steps.boot?.result;
		if (id === "boot" && boot?.mode === "ab")
			return (
				!!boot.generation &&
				!!boot.verified_slots?.includes("A") &&
				!!boot.verified_slots?.includes("B")
			);
		return state.steps[id] !== undefined;
	};
	const steps = procedure(d, { disk: state.steps.disk?.result }).map(
		(step): Omit<Step, "status"> => {
			const record = recordFor(step.id, state);
			const base = {
				id: step.id,
				title: step.title,
				about: step.about,
				guide: step.guide,
				summary: summary(step.id, state),
				doneAt: step.id === "finish" ? undefined : state.steps[step.id]?.done_at,
			};
			const run = step.run;
			switch (run.kind) {
				case "checks": {
					const checks = run.checks.map((check) => ({
						ok: exists(check.path),
						label: check.label,
						path: check.path,
						fix: check.fix,
					}));
					return {
						...base,
						checks,
						action:
							checks.every((check) => check.ok) && record
								? { kind: "record", label: "Continue to the disk", record }
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
							label: `Start ${run.argv[0]}`,
							byHand: record,
						},
					};
				case "commands":
					return {
						...base,
						action: {
							kind: "run",
							label: step.id === "finish" ? "Unmount and reboot" : "Install the boot loader",
							lines: run.lines,
							record,
						},
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
