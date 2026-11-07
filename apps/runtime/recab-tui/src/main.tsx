#!/usr/bin/env bun
import manifest from "../package.json";
import { runApp } from "@levitate/tui-kit";
import { RECAB_KEYMAP } from "./flows";
import { RuntimeRecabScreen } from "./presentation/runtime-recab-screen";

runApp({
	name: "recab-tui",
	summary: manifest.description,
	keys: [{ title: "Keys", keymap: RECAB_KEYMAP }],
	run: () => <RuntimeRecabScreen />,
});
