#!/bin/sh
# Re-record the stand-in's documents (see ./recpart) from the real recpart. Every plan
# and dry run reads a fixture disk's recorded inventory (inspect-<disk>.json, via
# --inventory), so nothing touches a device. A real apply needs root and a disk, so
# apply-<name>.json is the dry run with every step marked as run (status 0), and
# dry-run-refused.json is the ab dry run with the warning a mounted disk gives.
# RECPART overrides the binary (default: cargo run -p recpart).
set -eu
cd "$(dirname "$0")"
recpart() { ${RECPART:-cargo run -q -p recpart --} "$@"; }

# The fixture disks: vdz empty (the template stories' disk), vdy Windows with its EFI
# partition, vdx one nearly full ext4 partition, vdw a partition off 4 KiB alignment.
for disk in vdw vdx vdy vdz; do
	recpart inspect --disk "/dev/$disk" --inventory "inspect-$disk.json" --json >inspect.tmp
	mv inspect.tmp "inspect-$disk.json"
done
jq -s '{schema_version: 1, disks: [.[0].disk]}' inspect-vdz.json >list-disks.json
jq -s '{schema_version: 1, disks: [.[].disk]}' inspect-vdw.json inspect-vdx.json inspect-vdy.json inspect-vdz.json >list-disks-all.json

as_applied='.dry_run = false | .disk_checks_skipped = false | .steps |= map(.dry_run = false | .status = 0)'

# record <name> <disk> <mode> [recpart args]: plan-<name>, dry-run-<name> and
# apply-<name>, or error-<name> when recpart refuses the plan.
record() {
	name=$1 disk=$2 mode=$3
	shift 3
	set -- --disk "/dev/$disk" --mode "$mode" --inventory "inspect-$disk.json" --json "$@"
	rm -f "plan-$name.json" "dry-run-$name.json" "apply-$name.json" "error-$name.json"
	if recpart plan "$@" >"plan-$name.json" 2>"error-$name.json"; then
		rm "error-$name.json"
		recpart apply --dry-run "$@" >"dry-run-$name.json"
		jq "$as_applied" "dry-run-$name.json" >"apply-$name.json"
	else
		rm "plan-$name.json"
	fi
}

# The templates: on vdz under the names the template stories use, plan-<mode>-<disk> elsewhere.
for mode in ab mutable; do
	record "$mode" vdz "$mode"
	for disk in vdw vdx vdy; do
		record "$mode-$disk" "$disk" "$mode"
	done
done
jq '.disk_checks_skipped = false | .warnings = ["E001: [preflight] expected target disk and child partitions are not mounted, observed mounted points detected: /run/media/old. remediation: Unmount all target disk partitions before destructive apply."]' \
	dry-run-ab.json >dry-run-refused.json

# Manual layouts (layouts/<name>.json): the ones that plan, then one per refusal.
while read -r name disk mode; do
	record "$name" "$disk" "$mode" --layout "layouts/$name.json"
done <<'LAYOUTS'
manual-ab vdz ab
manual-mutable-swap vdz mutable
dualboot vdy ab
replace-vdx vdx mutable
refuse-keep-root vdx mutable
refuse-no-room vdx mutable
refuse-unequal-slots vdz ab
refuse-duplicate-mountpoint vdz mutable
refuse-small-slot vdz ab
refuse-efi-too-small vdz ab
refuse-resize-msr vdy ab
refuse-shrink-below-used vdx mutable
refuse-misaligned vdw mutable
refuse-disk-changed vdy ab
edit-empty vdz ab
edit-dualboot vdy ab
edit-vdy-none vdy ab
edit-vdy-shrunk vdy ab
edit-vdy-setup vdy ab
edit-vdz-setup vdz ab
LAYOUTS
