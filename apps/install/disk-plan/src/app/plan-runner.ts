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
  exitCode: number;
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

function spawnRecpart(command: string[]): RecpartRun {
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const result = Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => ({
    command,
    exitCode,
    stdout,
    stderr,
    json: exitCode === 0 ? stdout : stderr,
  }));
  return { result, kill: () => proc.kill() };
}

export function runRecpartPlan(disk: string, mode: InstallMode): Promise<RecpartRunResult> {
  return spawnRecpart(buildPlanCommand(disk, mode)).result;
}

export function runRecpartDryRun(disk: string, mode: InstallMode): Promise<RecpartRunResult> {
  return spawnRecpart(buildApplyCommand(disk, mode, { dryRun: true })).result;
}

/** Start the destructive apply. Callers must hold the handle and start it once. */
export function startRecpartApply(disk: string, mode: InstallMode): RecpartRun {
  return spawnRecpart(buildApplyCommand(disk, mode, { dryRun: false, confirmDestroy: true }));
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
  const run = await spawnRecpart(["recpart", "list-disks", "--json"]).result;
  if (run.exitCode !== 0) {
    throw new Error(`recpart list-disks failed: ${run.stderr.trim()}`);
  }
  const listed = parseRecpartJson<DiskListResult>(run.json, DISK_LIST_SCHEMA_VERSION);
  if (!listed) {
    throw new Error(`recpart list-disks did not print schema ${DISK_LIST_SCHEMA_VERSION} JSON`);
  }
  return listed.disks;
}
