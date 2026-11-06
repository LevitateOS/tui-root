import type { DiskInventory } from "../contract/recpart";

/**
 * Read a recpart JSON document of the expected schema version. recpart
 * produces these documents from the same Rust types the contract is
 * generated from, so the version is the only thing left to check.
 */
export function parseRecpartJson<T extends { schema_version: number }>(
  json: string,
  schemaVersion: number,
): T | null {
  try {
    const value = JSON.parse(json) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      (value as { schema_version?: unknown }).schema_version === schemaVersion
    ) {
      return value as T;
    }
  } catch {
    // not JSON
  }
  return null;
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/** recpart reports metadata the device does not provide as "unknown". */
export function known(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === "unknown" ? null : trimmed;
}

/** A stand-in card for an explicit --disk recpart did not list. */
export function unlistedDisk(path: string): DiskInventory {
  return {
    path,
    size_bytes: 0,
    logical_sector_bytes: 0,
    physical_sector_bytes: 0,
    model: "unknown",
    vendor: "unknown",
    serial: "unknown",
    transport: "unknown",
    rotational: false,
    removable: false,
    read_only: false,
  };
}
