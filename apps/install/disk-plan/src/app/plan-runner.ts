import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import type { DiskMode } from "../cli/parse-args";

export const REPO_ROOT = resolve(import.meta.dir, "../../../../../../");
export const RECPART_ROOT = resolve(REPO_ROOT, "tools/recpart");
export const RECPART_MANIFEST = resolve(RECPART_ROOT, "Cargo.toml");

export type RecpartRunResult = {
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  /** The recpart JSON document (stdout on success, stderr error payload on failure). */
  json: string | null;
};

export type PlanRunResult = RecpartRunResult;
export type ApplyRunResult = RecpartRunResult;

/** A running recpart process: await `result`, or `kill()` it. */
export type RecpartRun = {
  result: Promise<RecpartRunResult>;
  kill: () => void;
};

export type DiskCandidate = {
  path: string;
  size: string;
  model: string;
  vendor: string;
  serial: string;
  transport: string;
  rotational: boolean | null;
  removable: boolean | null;
  label: string;
};

export function buildPlanCommand(disk: string, mode: DiskMode): string[] {
  return ["recpart", "plan", "--disk", disk, "--mode", mode, "--json"];
}

export function buildApplyCommand(
  disk: string,
  mode: DiskMode,
  options: { dryRun: boolean; confirmDestroy?: boolean },
): string[] {
  const command = ["recpart", "apply", "--disk", disk, "--mode", mode, "--json"];
  if (options.dryRun) {
    command.push("--dry-run");
  } else if (options.confirmDestroy) {
    command.push("--confirm", "DESTROY");
  }
  return command;
}

/**
 * Extract the JSON document recpart printed. recpart pretty-prints, so the
 * whole stream is the document; fall back to the text from the first line
 * that opens an object in case anything was printed before it.
 */
export function extractJsonPayload(output: string): string | null {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const candidates = [trimmed];
  const start = trimmed.search(/^\{/m);
  if (start > 0) {
    candidates.push(trimmed.slice(start));
  }
  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function spawnRecpart(command: string[]): RecpartRun {
  const proc = Bun.spawn(command, {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const result = Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => ({
    command,
    exitCode,
    stdout,
    stderr,
    json: extractJsonPayload(exitCode === 0 ? stdout : stderr) ?? extractJsonPayload(stdout),
  }));

  return { result, kill: () => proc.kill() };
}

export function runRecpartPlan(disk: string, mode: DiskMode): Promise<PlanRunResult> {
  return spawnRecpart(buildPlanCommand(disk, mode)).result;
}

export function runRecpartDryRun(disk: string, mode: DiskMode): Promise<ApplyRunResult> {
  return spawnRecpart(buildApplyCommand(disk, mode, { dryRun: true })).result;
}

/** Start the destructive apply. Callers must hold the handle and start it once. */
export function startRecpartApply(disk: string, mode: DiskMode): RecpartRun {
  return spawnRecpart(buildApplyCommand(disk, mode, { dryRun: false, confirmDestroy: true }));
}

type LsblkDevice = {
  path?: string;
  size?: string;
  model?: string;
  vendor?: string;
  serial?: string;
  tran?: string;
  rota?: boolean | number | string;
  rm?: boolean | number | string;
  type?: string;
};

type LsblkJson = {
  blockdevices?: LsblkDevice[];
};

type UdevProps = Record<string, string>;

function humanizeDeviceText(input: string): string {
  return input.replaceAll("_", " ").replaceAll(/\s+/g, " ").trim();
}

function parseUdevProperties(raw: string): UdevProps {
  const properties: UdevProps = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || !trimmed.includes("=")) {
      continue;
    }
    const pivot = trimmed.indexOf("=");
    const key = trimmed.slice(0, pivot).trim();
    const value = trimmed.slice(pivot + 1).trim();
    if (key.length > 0) {
      properties[key] = value;
    }
  }
  return properties;
}

async function readUdevProperties(devicePath: string): Promise<UdevProps | null> {
  const proc = Bun.spawn(["udevadm", "info", "--query=property", "--name", devicePath], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  if (exitCode !== 0) {
    return null;
  }
  return parseUdevProperties(stdout);
}

/** Canonical device path (resolves /dev/disk/by-id/... links); input if unresolvable. */
export function resolveDiskPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

const LSBLK_COLUMNS = "PATH,SIZE,MODEL,VENDOR,SERIAL,TRAN,ROTA,RM,TYPE";

async function lsblkDevices(extraArgs: string[]): Promise<LsblkDevice[]> {
  const proc = Bun.spawn(["lsblk", "-J", "-d", "-o", LSBLK_COLUMNS, ...extraArgs], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  if (exitCode !== 0) {
    return [];
  }
  try {
    return (JSON.parse(stdout) as LsblkJson).blockdevices ?? [];
  } catch {
    return [];
  }
}

/**
 * List install-target candidates. `explicitDisk` (the --disk argument) is
 * always included when it is a whole disk or loop device, even though loop
 * devices are not listed by default, so an explicit target is never silently
 * replaced by another disk.
 */
export async function listHostDisks(explicitDisk = ""): Promise<DiskCandidate[]> {
  const raw = await lsblkDevices([]);
  const explicit = explicitDisk.trim().length > 0 ? resolveDiskPath(explicitDisk.trim()) : "";
  if (explicit.length > 0 && !raw.some((device) => device.path === explicit)) {
    const extra = await lsblkDevices([explicit]);
    raw.push(...extra.filter((device) => device.type === "disk" || device.type === "loop"));
  }

  const disks = raw
    .filter(
      (device) =>
        typeof device.path === "string" &&
        (device.type === "disk" || (device.type === "loop" && device.path === explicit)),
    )
    // zram swap devices report TYPE=disk but are never install targets.
    .filter((device) => !/^\/dev\/zram\d+$/.test((device.path ?? "").trim()))
    .map((device) => {
      const path = (device.path ?? "").trim();
      const size = (device.size ?? "?").trim();
      const model = (device.model ?? "").trim();
      const vendor = (device.vendor ?? "").trim();
      const serial = (device.serial ?? "").trim();
      const transport = (device.tran ?? "").trim();
      const rotational =
        device.rota === true || device.rota === 1 || device.rota === "1" || device.rota === "true";
      const removable =
        device.rm === true || device.rm === 1 || device.rm === "1" || device.rm === "true";
      const modelPart = model.length > 0 ? ` ${model}` : "";
      return {
        path,
        size,
        model,
        vendor,
        serial,
        transport,
        rotational: device.rota === undefined || device.rota === null ? null : rotational,
        removable: device.rm === undefined || device.rm === null ? null : removable,
        label: `${path} (${size})${modelPart}`,
      };
    })
    .filter((device) => device.path.length > 0);

  const enriched = await Promise.all(
    disks.map(async (disk) => {
      const udev = await readUdevProperties(disk.path);
      if (!udev) {
        return disk;
      }
      const vendor = humanizeDeviceText(
        udev.ID_VENDOR_FROM_DATABASE ?? udev.ID_VENDOR ?? disk.vendor,
      );
      const model = humanizeDeviceText(udev.ID_MODEL_FROM_DATABASE ?? udev.ID_MODEL ?? disk.model);
      const transport = (udev.ID_BUS ?? disk.transport).trim();
      const serial = (udev.ID_SERIAL_SHORT ?? disk.serial).trim();
      const labelModel = model.length > 0 ? ` ${model}` : "";
      return {
        ...disk,
        vendor,
        model,
        transport,
        serial,
        label: `${disk.path} (${disk.size})${labelModel}`,
      };
    }),
  );

  return enriched;
}
