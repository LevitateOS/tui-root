import { realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCommand, runDir, type CommandResult } from "@levitate/tui-kit";
import {
	CONFIRM_TOKEN,
	DISK_LIST_SCHEMA_VERSION,
	readRecpartOutput,
	type DiskInventory,
	type DiskListResult,
	type InstallMode,
	type ManualLayout,
} from "../generated/recpart";
import type { Run } from "../flow";

export const LIST_DISKS = ["recpart", "list-disks", "--json"] as const;

export function inspectCommand(disk: string): string[] {
	return ["recpart", "inspect", "--disk", disk, "--json"];
}

/** `layout` is an explicit layout's file (see `writeLayout`); without one, the mode's template. */
export function planCommand(disk: string, mode: InstallMode, layout: string | null): string[] {
	return ["recpart", "plan", "--disk", disk, "--mode", mode, ...layoutArgs(layout), "--json"];
}

/** `expected` is the plan the user reviewed (see `writeDocument`): recpart refuses (E023)
 * when the disk no longer gives that exact plan, so apply touches only the disk and
 * partitions that were shown. */
export function applyCommand(
	disk: string,
	mode: InstallMode,
	layout: string | null,
	expected: string | null,
	dryRun: boolean,
): string[] {
	return [
		"recpart",
		"apply",
		"--disk",
		disk,
		"--mode",
		mode,
		...layoutArgs(layout),
		...(expected ? ["--expect", expected] : []),
		"--json",
		...(dryRun ? ["--dry-run"] : ["--confirm", CONFIRM_TOKEN]),
	];
}

function layoutArgs(layout: string | null): string[] {
	return layout ? ["--layout", layout] : [];
}

/** Writes `layout` where recpart can read it (this run's directory, removed when it
 * ends). The name is the content's hash, so a changed
 * layout is a changed command and the plan runs again. */
export function writeLayout(layout: ManualLayout): string {
	return writeDocument("layout", layout);
}

/** Writes `value` as JSON to this run's temporary directory (removed when it ends), named by
 * its content, and returns the path: an explicit layout, or the plan apply must match. */
export function writeDocument(kind: "layout" | "plan", value: unknown): string {
	const text = `${JSON.stringify(value, null, "\t")}\n`;
	const path = join(runDir("disk-plan"), `${kind}-${Bun.hash(text).toString(16)}.json`);
	writeFileSync(path, text);
	return path;
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
