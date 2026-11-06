import { keymapHelp } from "@levitate/tui-kit";
import {
	CONFIRM_KEYS,
	CONTENT_KEYS,
	DISK_KEYS,
	GLOBAL_KEYS,
	MODE_KEYS,
	NAV_KEYS,
} from "../presentation/keymap";
import { INSTALL_MODES, type InstallMode } from "../contract/recpart";

export type DiskMode = InstallMode;

export type CliOptions = {
	disk: string | null;
	mode: DiskMode;
	help: boolean;
	error: string | null;
};

function parseMode(value: string | undefined): DiskMode | null {
	return INSTALL_MODES.find((mode) => mode === value) ?? null;
}

export function parseCliArgs(args: string[]): CliOptions {
	let disk: string | null = null;
	let mode: DiskMode = "ab";
	let help = false;
	let error: string | null = null;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (arg === "--help" || arg === "-h") {
			help = true;
			continue;
		}

		if (arg === "--disk") {
			const value = args[index + 1];
			if (!value || value.startsWith("-")) {
				error = "--disk requires a value";
				break;
			}
			disk = value;
			index += 1;
			continue;
		}

		if (arg === "--mode") {
			const value = args[index + 1];
			const parsed = parseMode(value);
			if (!parsed) {
				error = `--mode must be one of: ${INSTALL_MODES.join(", ")}`;
				break;
			}
			mode = parsed;
			index += 1;
			continue;
		}

		error = `unknown argument: ${arg}`;
		break;
	}

	return { disk, mode, help, error };
}

export function cliHelpText(): string {
	return [
		"install disk-plan (recpart-backed thin shell)",
		"",
		"Usage:",
		"  cargo xtask tui disk-plan",
		`  cargo xtask tui disk-plan --disk /dev/sdX [--mode ${INSTALL_MODES.join("|")}]`,
		`  bun src/main.ts [--disk /dev/sdX] [--mode ${INSTALL_MODES.join("|")}]`,
		"",
		"Notes:",
		"  - mode defaults to 'ab'",
		"  - --disk is optional (interactive selection if omitted)",
		"  - command runs: recpart plan --disk <disk> --mode <mode> --json",
		"",
		"Keys (every page):",
		keymapHelp(GLOBAL_KEYS),
		"Keys (page list focused):",
		keymapHelp(NAV_KEYS),
		"Keys (page content focused):",
		keymapHelp([...CONTENT_KEYS, ...DISK_KEYS, ...MODE_KEYS]),
		"Keys (destructive-confirm page; other typing goes into the token):",
		keymapHelp(CONFIRM_KEYS),
	].join("\n");
}
