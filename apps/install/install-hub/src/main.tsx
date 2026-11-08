#!/usr/bin/env bun
import manifest from "../package.json";
import { DISTROS } from "@levitate/docs-content/distros";
import { runApp, UsageError } from "@levitate/tui-kit";
import { runPending } from "./app/handoff";
import { HUB_KEYS } from "./presentation/keymap";
import { HubScreen } from "./presentation/hub-screen";

runApp({
	name: "install-hub",
	summary: manifest.description,
	flags: [
		{
			name: "os-name",
			value: "NAME",
			choices: DISTROS.map((d) => d.osName),
			help: "the distro being installed, as the install screen's launcher names it",
		},
	],
	notes: [
		"Each step either starts its app (disk-plan), runs the install guide's commands in this terminal, or opens a shell with them; the hub comes back when that ends. What each step did is kept in the install state file (LEVITATE_INSTALL_STATE, default /run/levitate-install/state.json), which the step apps read.",
	],
	keys: [{ title: "Keys", keymap: HUB_KEYS }],
	run: (args) => {
		const distro = DISTROS.find((d) => d.osName === args["os-name"]);
		if (!distro) throw new UsageError("--os-name names the distro being installed");
		return <HubScreen distro={distro} />;
	},
	afterExit: () => {
		const again = runPending();
		if (again) process.stdout.write("\x1b[2J\x1b[H");
		return again;
	},
});
