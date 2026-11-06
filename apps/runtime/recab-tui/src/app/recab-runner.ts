import { runCommand, type CommandResult } from "@levitate/tui-kit";
import type { Status } from "../generated/recab";
import { parseRecabStatusJson } from "../domain/recab";

/** `recab status --json`, the read the status panel shows. */
export const STATUS_ARGS: ReadonlyArray<string> = ["status", "--json"];

export function runRecabCommand(args: ReadonlyArray<string>): Promise<CommandResult> {
	return runCommand(["recab", ...args]);
}

export type StatusRead = { kind: "ok"; status: Status } | { kind: "failed"; reason: string };

/** recab's slot status, or why there is none. */
export async function readRecabStatus(): Promise<StatusRead> {
	const result = await runRecabCommand(STATUS_ARGS);
	if (result.exitCode !== 0) {
		const detail = (result.stderr || result.stdout).trim().split("\n")[0] ?? "";
		return {
			kind: "failed",
			reason: `recab status ${result.exitCode === null ? "did not run" : `exit ${result.exitCode}`}${detail ? `: ${detail}` : ""}`,
		};
	}
	const status = parseRecabStatusJson(result.stdout);
	return status
		? { kind: "ok", status }
		: { kind: "failed", reason: "recab status printed JSON of another shape" };
}
