import { spawn } from "node:child_process";
import { parseRecabStatusJson, type RecabCommandResult, type RecabStatus } from "../domain";

export async function runRecabCommand(spec: {
	recabBin: string;
	args: string[];
}): Promise<RecabCommandResult> {
	const startedAt = Date.now();

	return await new Promise<RecabCommandResult>((resolve) => {
		const child = spawn(spec.recabBin, spec.args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: process.env,
		});

		let stdout = "";
		let stderr = "";
		let failedToStart = false;
		let startErrorMessage: string | null = null;

		child.stdout?.on("data", (chunk: Buffer | string) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk: Buffer | string) => {
			stderr += chunk.toString();
		});
		child.on("error", (error: unknown) => {
			failedToStart = true;
			startErrorMessage = error instanceof Error ? error.message : String(error);
		});
		child.on("close", (code: number | null) => {
			const exitCode = failedToStart ? 127 : (code ?? 1);
			const durationMs = Date.now() - startedAt;
			const stderrText =
				startErrorMessage && startErrorMessage.trim().length > 0
					? `${stderr}${stderr.length > 0 ? "\n" : ""}${startErrorMessage}`
					: stderr;

			resolve({
				command: spec.recabBin,
				args: spec.args,
				exitCode,
				stdout,
				stderr: stderrText,
				durationMs,
				failedToStart,
			});
		});
	});
}

export async function runRecabStatus(spec: {
	recabBin: string;
}): Promise<{ result: RecabCommandResult; status: RecabStatus | null; parseError: string | null }> {
	const result = await runRecabCommand({
		recabBin: spec.recabBin,
		args: ["status", "--json"],
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
