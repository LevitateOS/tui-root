#!/usr/bin/env bun
import manifest from "../package.json";
import { runApp } from "@levitate/tui-kit";
import { CONFIRM_KEYS, MAIN_KEYS, TEXT_KEYS } from "./presentation/keymap";
import { RecabScreen } from "./presentation/recab-screen";

runApp({
	name: "recab-tui",
	summary: manifest.description,
	keys: [
		{ title: "Keys", keymap: MAIN_KEYS },
		{ title: "Keys (a change waits for a yes)", keymap: CONFIRM_KEYS },
		{ title: "Keys (typing a path or a slot's name)", keymap: TEXT_KEYS },
	],
	run: () => <RecabScreen />,
});
