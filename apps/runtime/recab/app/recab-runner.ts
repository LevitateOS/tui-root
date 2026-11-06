import { spawn } from "node:child_process";
import { parseRecabStatusJson, type RecabCommandResult, type Status } from "../domain";
import { STATUS_ARGS } from "../flows";

export async function runRecabCommand(spec: {
  recabBin: string;
  args: ReadonlyArray<string>;
}): Promise<RecabCommandResult> {
  const startedAt = Date.now();

  return await new Promise<RecabCommandResult>((resolve) => {
    const child = spawn(spec.recabBin, spec.args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let startErrorMessage: string | null = null;

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error: unknown) => {
      startErrorMessage = error instanceof Error ? error.message : String(error);
    });
    child.on("close", (code: number | null) => {
      const exitCode = startErrorMessage === null ? code : null;
      const durationMs = Date.now() - startedAt;
      const stderrText =
        startErrorMessage && startErrorMessage.trim().length > 0
          ? `${stderr}${stderr.length > 0 ? "\n" : ""}${startErrorMessage}`
          : stderr;

      resolve({
        command: spec.recabBin,
        args: [...spec.args],
        exitCode,
        stdout,
        stderr: stderrText,
        durationMs,
      });
    });
  });
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
