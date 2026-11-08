#!/usr/bin/env bun
import manifest from "../package.json";
import { runApp } from "@levitate/tui-kit";
import { THEN_FLAG, type Then } from "@levitate/install-state";
import { DEFAULT_INSTALL_MODE, INSTALL_MODES, type InstallMode } from "./generated/recpart";
import { DiskPlanScreen } from "./presentation/disk-plan-screen";
import {
	CONFIRM_KEYS,
	CONTENT_KEYS,
	DISK_KEYS,
	GLOBAL_KEYS,
	CHOICE_KEYS,
	PICK_KEYS,
	PARTITION_KEYS,
	TEXT_KEYS,
	NAV_KEYS,
} from "./presentation/keymap";

runApp({
	name: "disk-plan",
	summary: manifest.description,
	flags: [
		{ name: "disk", value: "DEVICE", help: "target disk (default: choose from recpart's list)" },
		{
			name: "mode",
			value: "MODE",
			choices: INSTALL_MODES,
			help: `install mode (default ${DEFAULT_INSTALL_MODE}): ${INSTALL_MODES.join(", ")}`,
		},
		THEN_FLAG,
	],
	keys: [
		{ title: "Keys (every page)", keymap: GLOBAL_KEYS },
		{ title: "Keys (page list focused)", keymap: NAV_KEYS },
		{
			title: "Keys (page content focused)",
			keymap: [...CONTENT_KEYS, ...DISK_KEYS, ...PICK_KEYS],
		},
		{ title: "Keys (partition editor)", keymap: PARTITION_KEYS },
		{ title: "Keys (editor asks to choose)", keymap: CHOICE_KEYS },
		{ title: "Keys (editor asks for a size or name)", keymap: TEXT_KEYS },
		{
			title: "Keys (destructive-confirm page; other typing goes into the token)",
			keymap: CONFIRM_KEYS,
		},
	],
	run: (args) => (
		<DiskPlanScreen
			disk={typeof args.disk === "string" ? args.disk : ""}
			mode={(args.mode as InstallMode | undefined) ?? DEFAULT_INSTALL_MODE}
			then={(args.then as Then | undefined) ?? "shell"}
		/>
	),
});
