import { realpathSync } from "node:fs";
import { runCommand, type CommandResult } from "@levitate/tui-kit";
import {
	CONFIRM_TOKEN,
	DISK_LIST_SCHEMA_VERSION,
	readRecpartOutput,
	type DiskInventory,
	type DiskListResult,
	type InstallMode,
} from "../generated/recpart";
import type { Run } from "../flow";

export const LIST_DISKS = ["recpart", "list-disks", "--json"] as const;

export function planCommand(disk: string, mode: InstallMode): string[] {
	return ["recpart", "plan", "--disk", disk, "--mode", mode, "--json"];
}

export function applyCommand(disk: string, mode: InstallMode, dryRun: boolean): string[] {
	return [
		"recpart",
		"apply",
		"--disk",
		disk,
		"--mode",
		mode,
		"--json",
		...(dryRun ? ["--dry-run"] : ["--confirm", CONFIRM_TOKEN]),
	];
}

/** A finished recpart run as the flow's `Run`: its document, or what went wrong. */
export function toRun<T extends { schema_version: number }>(
	result: CommandResult,
	schemaVersion: number,
): Run<T> {
	const output = readRecpartOutput<T>(result, schemaVersion);
	if (output.kind === "ok") {
		return { kind: "ok", argv: result.argv, value: output.value };
	}
	return {
		kind: "failed",
		argv: result.argv,
		exitCode: result.exitCode,
		output:
			output.kind === "unreadable"
				? `${output.reason}\n${(result.stderr || result.stdout).trim()}`
				: (result.stderr || result.stdout).trim(),
		error: output.kind === "error" ? output.error : null,
	};
}

/** Canonical device path (resolves /dev/disk/by-id/... links); the input if unresolvable. */
export function resolveDiskPath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

/** The install-target candidates, as `recpart list-disks` reports them. */
export async function listDisks(): Promise<DiskInventory[]> {
	const run = toRun<DiskListResult>(await runCommand(LIST_DISKS), DISK_LIST_SCHEMA_VERSION);
	if (run.kind !== "ok") {
		throw new Error(
			run.kind === "failed" && run.error
				? `${run.error.observed} (${run.error.remediation})`
				: "recpart list-disks failed",
		);
	}
	return run.value.disks;
}
