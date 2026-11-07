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

/** A signature on the whole disk, in words: "an encrypted LUKS container "vault"". */
export function describeSignature(signature: { kind: string; label: string | null }): string {
	const what: Record<string, string> = {
		crypto_LUKS: "an encrypted LUKS container",
		LVM2_member: "an LVM physical volume",
		linux_raid_member: "a RAID member",
		zfs_member: "a ZFS pool member",
		swap: "swap space",
	};
	const name = what[signature.kind] ?? `a ${signature.kind} filesystem`;
	return signature.label ? `${name} "${signature.label}"` : name;
}
