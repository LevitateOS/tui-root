import { useMemo } from "react";
import { runCommand, useAsyncTask } from "@levitate/tui-kit";
import { toRun } from "../app/plan-runner";
import type { Run } from "../flow";

/** Runs recpart `argv` whenever it changes (null: not yet), as a flow `Run`. The document is
 * parsed once per run, so it keeps its identity across renders. */
/** `argv`'s result, run again whenever `argv` or the round of `reads` changes (a result
 * from an earlier round or other arguments is dropped). */
export function useRecpartRun<T extends { schema_version: number }>(
	argv: readonly string[] | null,
	schemaVersion: number,
	reads: number,
): Run<T> {
	const task = useAsyncTask(argv ? `${reads}\u0000${argv.join("\u0000")}` : null, () =>
		runCommand(argv!),
	);
	const done = task.kind === "done" ? task.value : null;
	const parsed = useMemo(
		() => (done ? toRun<T>(done, schemaVersion) : null),
		[done, schemaVersion],
	);
	if (argv === null || task.kind === "idle") return { kind: "idle" };
	if (task.kind === "running") return { kind: "running", argv };
	if (task.kind === "error")
		return { kind: "failed", argv, exitCode: null, output: task.message, error: null };
	return parsed!;
}
