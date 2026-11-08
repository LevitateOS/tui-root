#!/usr/bin/env bun
import manifest from "../package.json";
import { runApp } from "@levitate/tui-kit";
import { THEN_FLAG, type Then } from "@levitate/install-state";
import { findTarget } from "./app/runner";
import { CONFIRM_KEYS, MAIN_KEYS } from "./presentation/keymap";
import { BaseScreen } from "./presentation/base-screen";

runApp({
	name: "base-system",
	summary: manifest.description,
	flags: [
		{
			name: "target",
			value: "PATH",
			help: "where the new system is mounted (default: the disk step's target from the install state file)",
		},
		THEN_FLAG,
	],
	keys: [
		{ title: "Keys", keymap: MAIN_KEYS },
		{ title: "Keys (replacing lines already in the fstab)", keymap: CONFIRM_KEYS },
	],
	run: (args) => {
		const found = findTarget(typeof args.target === "string" ? args.target : "");
		return (
			<BaseScreen
				target={found.target}
				stateError={found.error}
				then={(args.then as Then | undefined) ?? "shell"}
			/>
		);
	},
});
