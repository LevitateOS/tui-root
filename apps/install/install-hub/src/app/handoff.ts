/**
 * Handing the terminal to a step: the hub's screen ends with a pending action, the
 * action runs with the terminal to itself, and the screen starts again (runApp's `then`),
 * reading the state file afresh.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { emptyState, readState, recordStep, type InstallState } from "@levitate/install-state";
import type { Action, Record_ } from "../domain/steps";

let pending: Action | null = null;
/** The last thing that went wrong outside the screen, shown when it comes back. */
let lastNotice: string | null = null;

export function handOff(action: Action): void {
	pending = action;
}

export function takeNotice(): string | null {
	const notice = lastNotice;
	lastNotice = null;
	return notice;
}

/** Whether `path` exists on the live system, for the preflight checks. */
export function exists(path: string): boolean {
	return existsSync(path);
}

/** The install state, or why it can't be used (the hub then refuses every step). */
export function loadState(): { state: InstallState; error: string | null } {
	try {
		return { state: readState(), error: null };
	} catch (error) {
		return {
			state: emptyState(),
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export function record(entry: Record_): string | null {
	try {
		recordStep(entry.step, entry.result);
		return null;
	} catch (error) {
		return `couldn't save the step: ${error instanceof Error ? error.message : String(error)}`;
	}
}

function shell(): string {
	return process.env.SHELL || "/bin/sh";
}

function say(lines: readonly string[]): void {
	process.stdout.write("\x1b[2J\x1b[H");
	for (const line of lines) process.stdout.write(`${line}\n`);
}

function waitForEnter(): void {
	spawnSync(
		"/bin/sh",
		["-c", "printf '\\nPress Enter to go back to the install steps. '; read _"],
		{
			stdio: "inherit",
		},
	);
}

/** Runs the pending action, if any; true to show the hub again. */
export function runPending(): boolean {
	const action = pending;
	pending = null;
	if (!action) return false;
	switch (action.kind) {
		case "app": {
			const result = spawnSync(action.argv[0]!, action.argv.slice(1), { stdio: "inherit" });
			if (result.error) lastNotice = `couldn't start ${action.argv[0]}: ${result.error.message}`;
			break;
		}
		case "shell": {
			say(
				action.lines.length > 0
					? [
							"The install steps wait while you work in this shell. Commands for this step:",
							"",
							...action.lines.map((line) => `  ${line}`),
							"",
							"Type exit to go back, then mark the step done with m.",
							"",
						]
					: ["The install steps wait while you work in this shell. Type exit to go back.", ""],
			);
			spawnSync(shell(), ["-l"], { stdio: "inherit" });
			break;
		}
		case "run": {
			say([]);
			const script = action.lines
				.map((line) => `printf '$ %s\\n' '${line.replace(/'/g, `'\\''`)}'\n${line} || exit $?`)
				.join("\n");
			const result = spawnSync("/bin/sh", ["-c", script], { stdio: "inherit" });
			const ok = result.status === 0;
			process.stdout.write(
				ok
					? "\nDone.\n"
					: `\nStopped: exit status ${result.status ?? result.signal ?? "unknown"}.\n`,
			);
			if (ok && action.record) lastNotice = record(action.record);
			else if (!ok) lastNotice = "the step's commands failed; their output was above";
			waitForEnter();
			break;
		}
		case "record":
		case "none":
			break;
	}
	return true;
}

/** Leaves the hub for a shell and comes back. */
export const SHELL_ACTION: Action = { kind: "shell", label: "shell", lines: [] };
