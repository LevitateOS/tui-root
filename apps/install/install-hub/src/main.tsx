#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import manifest from "../package.json";
import { runApp } from "@levitate/tui-kit";
import { runPending } from "./app/handoff";
import { HUB_KEYS } from "./presentation/keymap";
import { HubScreen } from "./presentation/hub-screen";

/** NAME from /etc/os-release, for the title. */
function osName(): string {
	try {
		const text = readFileSync("/etc/os-release", "utf8");
		return /^NAME=["']?([^"'\n]*)/m.exec(text)?.[1]?.trim() || "System";
	} catch {
		return "System";
	}
}

runApp({
	name: "install-hub",
	summary: manifest.description,
	notes: [
		"Each step either starts its app (disk-plan), runs the install guide's commands in this terminal, or opens a shell with them; the hub comes back when that ends. What each step did is kept in the install state file (LEVITATE_INSTALL_STATE, default /run/levitate-install/state.json), which the step apps read.",
	],
	keys: [{ title: "Keys", keymap: HUB_KEYS }],
	run: () => <HubScreen osName={osName()} />,
	afterExit: () => {
		const again = runPending();
		if (again) process.stdout.write("\x1b[2J\x1b[H");
		return again;
	},
});
