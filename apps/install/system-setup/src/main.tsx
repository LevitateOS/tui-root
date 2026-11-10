#!/usr/bin/env bun
import manifest from "../package.json";
import { brandOf, distroOfOsRelease } from "@levitate/docs-content/brand";
import { brandTheme, readOsRelease, runApp } from "@levitate/tui-kit";
import { THEN_FLAG, type Then } from "@levitate/install-state";
import { findTarget } from "./app/runner";
import {
	AGAIN_KEYS,
	CONFIRM_KEYS,
	KEYBOARD_KEYS,
	MAIN_KEYS,
	PAGE_KEYS,
	reviewKeys,
	TEXT_KEYS,
} from "./presentation/keymap";
import { SetupScreen } from "./presentation/setup-screen";

runApp({
	name: "system-setup",
	summary: manifest.description,
	// The live system is the distro being installed: its colours.
	theme: brandTheme(brandOf(distroOfOsRelease(readOsRelease()))),
	flags: [
		{
			name: "target",
			value: "PATH",
			help: "where the new system is mounted (default: the disk step's target from the install state file)",
		},
		THEN_FLAG,
	],
	notes: [
		"Passwords are typed twice, shown as dots, and handed to recsetup on its standard input: they are never part of a command line and are not kept after the app ends.",
	],
	keys: [
		{ title: "Keys", keymap: [...MAIN_KEYS, ...AGAIN_KEYS] },
		{
			title: "Keys (the review page)",
			keymap: reviewKeys("the commands, and back to the answers"),
		},
		{
			title: "Keys (choosing from a list; the keyboard list adds Tab)",
			keymap: [...KEYBOARD_KEYS, ...PAGE_KEYS],
		},
		{ title: "Keys (typing a name or a password)", keymap: TEXT_KEYS },
		{ title: "Keys (before the configuration is applied)", keymap: CONFIRM_KEYS },
	],
	run: (args) => {
		const found = findTarget(typeof args.target === "string" ? args.target : "");
		return (
			<SetupScreen
				target={found.target}
				stateError={found.error}
				then={(args.then as Then | undefined) ?? "shell"}
			/>
		);
	},
});
