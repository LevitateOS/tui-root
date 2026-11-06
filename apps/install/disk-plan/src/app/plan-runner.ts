import { startCommand } from "@levitate/tui-kit";
import { realpathSync } from "node:fs";
import {
	CONFIRM_TOKEN,
	DISK_LIST_SCHEMA_VERSION,
	type DiskInventory,
	type DiskListResult,
	type InstallMode,
	readRecpartOutput,
} from "../generated/recpart";

export type RecpartRunResult = {
	command: string[];
	/** null when recpart could not be started. */
	exitCode: number | null;
	stdout: string;
	stderr: string;
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

/** Runs recpart (from PATH); read its documents with the generated `readRecpartOutput`. */
export function startRecpart(command: string[]): RecpartRun {
	const running = startCommand(command);
	const result = running.result.then((run) => ({
		command,
		exitCode: run.exitCode,
		stdout: run.stdout,
		stderr: run.stderr,
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
	const output = readRecpartOutput<DiskListResult>(
		await runRecpart(["recpart", "list-disks", "--json"]),
		DISK_LIST_SCHEMA_VERSION,
	);
	if (output.kind === "error") {
		throw new Error(`${output.error.observed} (${output.error.remediation})`);
	}
	if (output.kind === "unreadable") {
		throw new Error(output.reason);
	}
	return output.value.disks;
}
