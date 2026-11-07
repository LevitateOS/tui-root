import { recordStep, statePath, type DiskResult } from "@levitate/install-state";
import type { ApplyResult, InstallMode } from "../generated/recpart";

/** Whether the disk step reached the install state file, for the Done page. */
export type Saved =
	| { kind: "ok"; path: string }
	| { kind: "failed"; path: string; message: string };

/** recpart's handoff, as the later install steps need it. */
export function diskResult(disk: string, mode: InstallMode, applied: ApplyResult): DiskResult {
	const { handoff } = applied;
	return {
		disk,
		mode,
		target: handoff.install_target,
		mounts: handoff.mount_map.map((entry) => ({ path: entry.path, device: entry.device })),
		slot_a: handoff.mode_context.slot_a_device,
		slot_b: handoff.mode_context.slot_b_device,
		root_device:
			handoff.mount_map.find((entry) => entry.path === handoff.install_target)?.device ?? null,
	};
}

/** Records the applied disk as the install's disk step. */
export function saveDiskStep(disk: string, mode: InstallMode, applied: ApplyResult): Saved {
	const path = statePath();
	try {
		recordStep("disk", diskResult(disk, mode, applied), path);
		return { kind: "ok", path };
	} catch (error) {
		return {
			kind: "failed",
			path,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}
