import type { Status } from "../domain/contract";
import { parseRecabStatusJson, type RecabCommandResult } from "../domain/recab";
import { STATUS_ARGS } from "../flows";

export async function runRecabCommand(spec: {
	recabBin: string;
	args: ReadonlyArray<string>;
}): Promise<RecabCommandResult> {
	const startedAt = Date.now();
	const result = (exitCode: number | null, stdout: string, stderr: string): RecabCommandResult => ({
		command: spec.recabBin,
		args: [...spec.args],
		exitCode,
		stdout,
		stderr,
		durationMs: Date.now() - startedAt,
	});

	let child;
	try {
		child = Bun.spawn([spec.recabBin, ...spec.args], {
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		});
	} catch (error) {
		return result(null, "", error instanceof Error ? error.message : String(error));
	}
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return result(exitCode, stdout, stderr);
}

export async function runRecabStatus(spec: {
	recabBin: string;
}): Promise<{ result: RecabCommandResult; status: Status | null; parseError: string | null }> {
	const result = await runRecabCommand({
		recabBin: spec.recabBin,
		args: STATUS_ARGS,
	});
	if (result.exitCode !== 0) {
		return {
			result,
			status: null,
			parseError: null,
		};
	}

	const parsed = parseRecabStatusJson(result.stdout);
	if (!parsed) {
		return {
			result,
			status: null,
			parseError: "recab status returned non-conforming JSON payload",
		};
	}

	return {
		result,
		status: parsed,
		parseError: null,
	};
}
