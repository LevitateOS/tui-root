#!/usr/bin/env bun
import manifest from "../package.json";
import { brandOf, distroOfOsRelease } from "@levitate/docs-content/brand";
import { brandTheme, readOsRelease, runApp } from "@levitate/tui-kit";
import { CONFIRM_KEYS, MAIN_KEYS, TEXT_KEYS } from "./presentation/keymap";
import { RecabScreen } from "./presentation/recab-screen";

runApp({
	name: "recab-tui",
	summary: manifest.description,
	// The running system is the distro: its colours.
	theme: brandTheme(brandOf(distroOfOsRelease(readOsRelease()))),
	keys: [
		{ title: "Keys", keymap: MAIN_KEYS },
		{ title: "Keys (a change waits for a yes)", keymap: CONFIRM_KEYS },
		{ title: "Keys (typing a path or a slot's name)", keymap: TEXT_KEYS },
	],
	run: () => <RecabScreen />,
});
