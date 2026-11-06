import { runCommand, type CommandResult } from "@levitate/tui-kit";
import type { Status } from "../generated/recab";
import { parseRecabStatusJson } from "../domain/recab";
import { STATUS_ARGS } from "../flows";

/** Runs `recab` from PATH. */
export function runRecabCommand(args: ReadonlyArray<string>): Promise<CommandResult> {
	return runCommand(["recab", ...args]);
}

export async function runRecabStatus(): Promise<{
	result: CommandResult;
	status: Status | null;
	parseError: string | null;
}> {
	const result = await runRecabCommand(STATUS_ARGS);
	if (result.exitCode !== 0) {
		return { result, status: null, parseError: null };
	}
	const parsed = parseRecabStatusJson(result.stdout);
	return parsed
		? { result, status: parsed, parseError: null }
		: { result, status: null, parseError: "recab status returned non-conforming JSON payload" };
}
