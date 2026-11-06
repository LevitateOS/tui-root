import { startCommand } from "@levitate/tui-kit";
import { realpathSync } from "node:fs";
import {
	CONFIRM_TOKEN,
	DISK_LIST_SCHEMA_VERSION,
	type DiskInventory,
	type DiskListResult,
	type InstallMode,
} from "../contract/recpart";
import { parseRecpartJson } from "../domain/recpart";

export type RecpartRunResult = {
	command: string[];
	/** null when recpart could not be started. */
	exitCode: number | null;
	stdout: string;
	stderr: string;
	/** recpart's JSON document: stdout on success, the error payload on stderr on failure. */
	json: string;
};

/** A running recpart process: await `result`, or `kill()` it. */
export type RecpartRun = {
	result: Promise<RecpartRunResult>;
	kill: () => void;
};

export function buildPlanCommand(disk: string, mode: InstallMode): string[] {
	return ["recpart", "plan", "--disk", disk, "--mode", mode, "--json"];
}

export function buildApplyCommand(
	disk: string,
	mode: InstallMode,
	options: { dryRun: boolean; confirmDestroy?: boolean },
): string[] {
	const command = ["recpart", "apply", "--disk", disk, "--mode", mode, "--json"];
	if (options.dryRun) {
		command.push("--dry-run");
	} else if (options.confirmDestroy) {
		command.push("--confirm", CONFIRM_TOKEN);
	}
	return command;
}

/** Runs recpart (from PATH) and keeps its JSON document: stdout on success, stderr on failure. */
export function startRecpart(command: string[]): RecpartRun {
	const running = startCommand(command);
	const result = running.result.then((run) => ({
		command,
		exitCode: run.exitCode,
		stdout: run.stdout,
		stderr: run.stderr,
		json: run.exitCode === 0 ? run.stdout : run.stderr,
	}));
	return { result, kill: running.kill };
}

export function runRecpart(command: string[]): Promise<RecpartRunResult> {
	return startRecpart(command).result;
}

/** Canonical device path (resolves /dev/disk/by-id/... links); input if unresolvable. */
export function resolveDiskPath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

/** The install-target candidates, as `recpart list-disks` reports them. */
export async function listDisks(): Promise<DiskInventory[]> {
	const run = await runRecpart(["recpart", "list-disks", "--json"]);
	if (run.exitCode !== 0) {
		throw new Error(`recpart list-disks failed: ${run.stderr.trim()}`);
	}
	const listed = parseRecpartJson<DiskListResult>(run.json, DISK_LIST_SCHEMA_VERSION);
	if (!listed) {
		throw new Error(`recpart list-disks did not print schema ${DISK_LIST_SCHEMA_VERSION} JSON`);
	}
	return listed.disks;
}
