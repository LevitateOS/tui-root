import type { DiskResult, InstallState, StepName, StepResults } from "@levitate/install-state";

/** What the live system looks like, for the preflight step. */
export interface Facts {
	/** Booted in UEFI mode: /sys/firmware/efi exists. */
	uefi: boolean;
	/** The system image the install copies: /run/live-rootfs.erofs exists. */
	media: boolean;
}

/** What doing a step means. */
export type Action =
	/** Start the step's app; it records its own result. */
	| { kind: "app"; argv: readonly string[]; label: string }
	/** Run the guide's commands in the terminal; on success, record `step`. */
	| { kind: "run"; lines: readonly string[]; label: string; record?: Record_ }
	/** Record `step` now (nothing to run). */
	| { kind: "record"; label: string; record: Record_ }
	/** A shell with the guide's commands to type; with `record`, the user marks the step done after. */
	| { kind: "shell"; lines: readonly string[]; label: string; record?: Record_ }
	/** Nothing to do yet, and why. */
	| { kind: "none"; why: string };

export type Record_ = { [S in StepName]: { step: S; result: StepResults[S] } }[StepName];

export type StepStatus = "done" | "current" | "blocked";

export interface Step {
	id: StepName | "finish";
	title: string;
	/** One line on what the step does. */
	about: string;
	status: StepStatus;
	/** What it did, once done. */
	summary?: string;
	/** Checks or facts to show. */
	checks?: readonly { ok: boolean; label: string; fix?: string }[];
	action: Action;
	/** The install guide page for it (install-docs slug; AcornOS opens its counterpart). */
	docs: string;
}

/** The mode's boot arguments for recsetup, from the disk step. */
export function bootArgs(disk: DiskResult): string {
	return disk.mode === "ab"
		? `--boot ab --slot-a ${disk.slot_a ?? "SLOT_A"} --slot-b ${disk.slot_b ?? "SLOT_B"}`
		: `--boot mutable --root-device ${disk.root_device ?? "ROOT"}`;
}

function shellQuote(word: string): string {
	return /^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

/** Every install step, in order, with where the install stands. */
export function installSteps(state: InstallState, facts: Facts): Step[] {
	const done = (name: StepName) => state.steps[name] !== undefined;
	const disk = state.steps.disk?.result;
	const base = state.steps.base?.result;
	const target = disk ? shellQuote(disk.target) : "/mnt";
	const steps: Omit<Step, "status">[] = [
		{
			id: "preflight",
			title: "Preflight",
			about: "Check that this machine can take the install.",
			checks: [
				{
					ok: facts.uefi,
					label: "Booted in UEFI mode",
					fix: "Reboot and pick the UEFI entry for the install media in the firmware's boot menu.",
				},
				{
					ok: facts.media,
					label: "Install media mounted (/run/live-rootfs.erofs)",
					fix: "Boot the live ISO again; the system image it installs is missing.",
				},
			],
			action:
				facts.uefi && facts.media
					? {
							kind: "record",
							label: "continue",
							record: { step: "preflight", result: { uefi: true, media: true } },
						}
					: { kind: "none", why: "Fix the failed checks first." },
			docs: "installation-disk",
		},
		{
			id: "disk",
			title: "Disk",
			about: "Choose a disk and a layout, then partition, format and mount it.",
			summary: disk
				? `${disk.disk}, ${disk.mode === "ab" ? "A/B" : "mutable"}, at ${disk.target}`
				: undefined,
			action: { kind: "app", argv: ["disk-plan"], label: "open disk-plan" },
			docs: "installation-disk",
		},
		{
			id: "base",
			title: "Base system",
			about: "Copy the system onto the disk and write its fstab.",
			summary: base
				? typeof base.entries === "number" && base.entries > 0
					? `${base.entries.toLocaleString("en-US")} files copied to ${base.target}, fstab written`
					: `copied to ${base.target}`
				: undefined,
			action: disk
				? { kind: "app", argv: ["base-system"], label: "open base-system" }
				: { kind: "none", why: "The disk step says where the system goes." },
			docs: "installation-base",
		},
		{
			id: "setup",
			title: "Configuration",
			about: "Time zone, locale, keymap, hostname, root password and a user.",
			summary: done("setup") ? "marked done" : undefined,
			action: {
				kind: "shell",
				label: "open a shell for these",
				lines: [
					`recsetup inspect --root ${target}`,
					`recsetup apply --root ${target} --timezone Europe/Brussels --locale en_US.UTF-8 --hostname myhost`,
					`recchroot ${target} -- passwd`,
				],
				record: { step: "setup", result: { manual: true } },
			},
			docs: "installation-config",
		},
		{
			id: "boot",
			title: "Boot",
			about: "Install systemd-boot and the boot entries.",
			summary: done("boot")
				? `boot entries written (${disk?.mode === "ab" ? "A/B" : "mutable"})`
				: undefined,
			action: disk
				? {
						kind: "run",
						label: "run this",
						lines: [`recsetup apply --root ${target} ${bootArgs(disk)} --machine-id`],
						record: { step: "boot", result: { mode: disk.mode } },
					}
				: { kind: "none", why: "The disk step names the slots to boot." },
			docs: "installation-boot",
		},
		{
			id: "finish",
			title: "Finish",
			about:
				"Unmount the new system and reboot into it. Remove the install media when the machine restarts.",
			action: {
				kind: "run",
				label: "unmount and reboot",
				lines: [`umount -R ${target}`, "reboot"],
			},
			docs: "installation-boot",
		},
	];
	const isDone = (id: Step["id"]) => id !== "finish" && done(id);
	const current = steps.findIndex((step) => !isDone(step.id));
	return steps.map((step, i) => ({
		...step,
		status: isDone(step.id) ? "done" : i === current ? "current" : "blocked",
	}));
}
