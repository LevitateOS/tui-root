/** How the apps write sizes, counts and devices: one rule each. */

const IEC = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] as const;

/** `bytes` in IEC units with one decimal ("1.5 GiB", "20.0 GiB", "512 B"); nothing is "0 B". */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < IEC.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${unit === 0 ? value : value.toFixed(1)} ${IEC[unit]}`;
}

/** A count with thousands separators ("48,213"). */
export function formatCount(count: number): string {
	return count.toLocaleString("en-US");
}

/** A device's name without `/dev/` ("nvme0n1p2"). */
export function shortDevice(device: string): string {
	return device.replace(/^\/dev\//, "");
}
