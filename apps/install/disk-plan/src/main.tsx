#!/usr/bin/env bun
import { runApp } from "@levitate/tui-kit";
import { INSTALL_MODES, type InstallMode } from "./contract/recpart";
import { DiskPlanScreen } from "./presentation/disk-plan-screen";
import {
	CONFIRM_KEYS,
	CONTENT_KEYS,
	DISK_KEYS,
	GLOBAL_KEYS,
	MODE_KEYS,
	NAV_KEYS,
} from "./presentation/keymap";

runApp({
	name: "disk-plan",
	summary: "plan, check and apply a disk layout with the recpart on PATH",
	flags: [
		{ name: "disk", value: "DEVICE", help: "target disk (default: choose from recpart's list)" },
		{
			name: "mode",
			value: "MODE",
			choices: INSTALL_MODES,
			help: `install mode (default ab): ${INSTALL_MODES.join(", ")}`,
		},
	],
	keys: [
		{ title: "Keys (every page)", keymap: GLOBAL_KEYS },
		{ title: "Keys (page list focused)", keymap: NAV_KEYS },
		{ title: "Keys (page content focused)", keymap: [...CONTENT_KEYS, ...DISK_KEYS, ...MODE_KEYS] },
		{
			title: "Keys (destructive-confirm page; other typing goes into the token)",
			keymap: CONFIRM_KEYS,
		},
	],
	run: (args) => (
		<DiskPlanScreen
			disk={typeof args.disk === "string" ? args.disk : ""}
			mode={(args.mode as InstallMode | undefined) ?? "ab"}
		/>
	),
});
