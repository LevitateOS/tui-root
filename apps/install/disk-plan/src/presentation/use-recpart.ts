import { runCommand, useAsyncTask } from "@levitate/tui-kit";
import { toRun } from "../app/plan-runner";
import type { Run } from "../flow";

/** Runs recpart `argv` whenever it changes (null: not yet), as a flow `Run`. */
export function useRecpartRun<T extends { schema_version: number }>(
	argv: readonly string[] | null,
	schemaVersion: number,
): Run<T> {
	const task = useAsyncTask(argv ? argv.join("\u0000") : null, () => runCommand(argv!));
	if (argv === null || task.kind === "idle") return { kind: "idle" };
	if (task.kind === "running") return { kind: "running", argv };
	if (task.kind === "error")
		return { kind: "failed", argv, exitCode: null, output: task.message, error: null };
	return toRun<T>(task.value, schemaVersion);
}
