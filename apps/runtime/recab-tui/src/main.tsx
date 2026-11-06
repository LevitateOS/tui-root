#!/usr/bin/env bun
import { runApp } from "@levitate/tui-kit";
import { RECAB_KEYMAP } from "./flows";
import { RuntimeRecabScreen } from "./presentation/runtime-recab-screen";

runApp({
	name: "recab-tui",
	summary: "A/B slot status and switching, over the recab on PATH",
	keys: [{ title: "Keys", keymap: RECAB_KEYMAP }],
	run: () => <RuntimeRecabScreen />,
});
