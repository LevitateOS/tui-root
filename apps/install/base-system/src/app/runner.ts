/** The commands the base step runs, and the install state file it reads and writes. */
import { readState, recordStep, statePath, type BaseResult } from "@levitate/install-state";
import { errorMessage, type CommandResult } from "@levitate/tui-kit";
import { FSTAB_SCHEMA_VERSION, readErrorPayload, type FstabResult } from "../generated/recstrap";
import type { Failure, Run, Saved, Target } from "../domain/base";

export function checkCommand(target: string): string[] {
	return ["recstrap", target, "--check", "--json"];
}

export function copyCommand(target: string): string[] {
	return ["recstrap", target, "--json"];
}

export function fstabCommand(target: string, write: "no" | "append" | "replace"): string[] {
	return [
		"recfstab",
		target,
		...(write === "no" ? [] : write === "append" ? ["--write"] : ["--write", "--replace"]),
		"--json",
	];
}

/** What a failed run left: its error document, or what it printed. */
export function failure(result: CommandResult, note?: string): Failure {
	return {
		argv: result.argv,
		exitCode: result.exitCode,
		error: readErrorPayload(result.stderr),
		output: [note, (result.stderr || result.stdout).trim()].filter(Boolean).join("\n"),
	};
}

/** A finished `recfstab --json`. */
export function toFstabRun(result: CommandResult): Run<FstabResult> {
	if (result.exitCode !== 0) return { kind: "failed", failure: failure(result) };
	try {
		const value = JSON.parse(result.stdout) as FstabResult;
		if (value.schema_version === FSTAB_SCHEMA_VERSION)
			return { kind: "ok", argv: result.argv, value };
		return {
			kind: "failed",
			failure: failure(
				result,
				`recfstab printed schema ${String(value.schema_version)}, expected ${FSTAB_SCHEMA_VERSION}`,
			),
		};
	} catch {
		return { kind: "failed", failure: failure(result, "recfstab printed no JSON") };
	}
}

/** Where the system goes: `--target`, else the disk step's target. Also the state file's
 * error, when it can't be read. */
export function findTarget(flag: string): { target: Target | null; error: string | null } {
	let disk = null;
	let error = null;
	try {
		disk = readState().steps.disk?.result ?? null;
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
	}
	const path = flag.trim() || disk?.target || null;
	if (!path) return { target: null, error };
	return { target: { path, disk: disk && disk.target === path ? disk : null }, error };
}

/** Records the base step. */
export function saveBaseStep(result: BaseResult): Saved {
	const path = statePath();
	try {
		recordStep("base", result, path);
		return { kind: "ok", path };
	} catch (error) {
		return {
			kind: "failed",
			path,
			message: errorMessage(error),
		};
	}
}
