/**
 * Handing the terminal to a step: the hub's screen hands its action off (the kit's
 * `useHandOff`), `runAction` runs it with the terminal to itself, and the screen starts
 * again with the notice it returns, reading the state file afresh.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { shellQuote } from "@levitate/docs-content/install";
import { emptyState, readState, recordStep, type InstallState } from "@levitate/install-state";
import { describeTerminalRun, errorMessage, runInTerminal, waitForEnter } from "@levitate/tui-kit";
import type { Action, Record_ } from "../domain/steps";

/** Where the hub runs: the live system's root (stories point it at a fixture tree) and the install shell. */
export interface Live {
	root: string;
	shell: string;
}

/** Whether `path` exists on the live system, for the preflight checks. */
export function exists(live: Live, path: string): boolean {
	return existsSync(join(live.root, path));
}

/** The install state, or why it can't be used (the hub then refuses every step). */
export function loadState(): { state: InstallState; error: string | null } {
	try {
		return { state: readState(), error: null };
	} catch (error) {
		return { state: emptyState(), error: errorMessage(error) };
	}
}

export function record(entry: Record_): string | null {
	try {
		if (entry.step === "boot" && entry.result.mode === "ab") {
			const target = readState().steps.disk?.result.target;
			if (!target) return "The installation target is missing";
			const q = spawnSync("recab", ["--json", "verify-installation", "--root", target], {
				encoding: "utf8",
			});
			if (q.status !== 0)
				return (
					q.stderr.trim() || "Both personalized bootable systems must be verified before finishing"
				);
			const proof = JSON.parse(q.stdout);
			if (
				proof.complete !== true ||
				!proof.slots?.includes("A") ||
				!proof.slots?.includes("B") ||
				!proof.generation
			)
				return "Both initial roots must be verified";
			entry = {
				step: "boot",
				result: { ...entry.result, verified_slots: proof.slots, generation: proof.generation },
			};
		}
		recordStep(entry.step, entry.result);
		return null;
	} catch (error) {
		return `couldn't save the step: ${errorMessage(error)}`;
	}
}

function say(lines: readonly string[]): void {
	process.stdout.write("\x1b[2J\x1b[H");
	for (const line of lines) process.stdout.write(`${line}\n`);
}

/** Runs `action` with the terminal to itself; what to tell the user when the hub comes back, if anything. */
export function runAction(action: Action, live: Live): string | null {
	switch (action.kind) {
		case "app": {
			const run = runInTerminal(action.argv);
			return run.kind === "exited" && run.status === 0
				? null
				: `${action.argv[0]} ended: ${describeTerminalRun(run)}`;
		}
		case "shell": {
			say(["The install steps wait while you work in this shell. Type exit to go back.", ""]);
			const run = runInTerminal([live.shell, "-l"]);
			return run.kind === "not-started" ? `couldn't open ${live.shell}: ${run.error}` : null;
		}
		case "run": {
			say([]);
			// Each line is shown, then run; the first failure stops the rest.
			const script = action.lines
				.map((line) => `printf '$ %s\\n' ${shellQuote(line)}\n${line} || exit $?`)
				.join("\n");
			const run = runInTerminal([live.shell, "-c", script]);
			const ok = run.kind === "exited" && run.status === 0;
			process.stdout.write(ok ? "\nDone.\n" : `\nStopped: ${describeTerminalRun(run)}.\n`);
			waitForEnter("\nPress Enter to go back to the install steps. ");
			if (!ok) return "the step's commands failed; their output was above";
			return action.record ? record(action.record) : null;
		}
		case "record":
		case "none":
			return null;
	}
}

/** Leaves the hub for a shell and comes back. */
export const SHELL_ACTION: Action = { kind: "shell", label: "shell" };
