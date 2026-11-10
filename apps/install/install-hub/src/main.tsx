#!/usr/bin/env bun
import manifest from "../package.json";
import { DISTROS } from "@levitate/docs-content/distros";
import { runApp, UsageError, type Args } from "@levitate/tui-kit";
import { DEFAULT_STATE_PATH, STATE_PATH_ENV } from "@levitate/install-state";
import { runAction, type Live } from "./app/handoff";
import type { Action } from "./domain/steps";
import { HUB_KEYS } from "./presentation/keymap";
import { HubScreen } from "./presentation/hub-screen";

/** What the screen shows when it comes back from a step. */
type Carried = { notice: string | null };

function liveFrom(args: Args): Live {
	if (typeof args.shell !== "string") throw new UsageError("--shell names the install shell");
	return {
		shell: args.shell,
		root: typeof args["live-root"] === "string" ? args["live-root"] : "/",
	};
}

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
		{
			name: "shell",
			value: "PATH",
			help: "the install shell: opened for typed steps, and running the steps' commands",
		},
		{
			name: "live-root",
			value: "DIR",
			help: "the live system's root, where the preflight checks look (default /)",
		},
	],
	notes: [
		`Each step either starts its app (disk-plan, base-system, system-setup) or runs the install guide's commands in this terminal; the hub comes back when that ends. What each step did is kept in the install state file (${STATE_PATH_ENV}, default ${DEFAULT_STATE_PATH}), which the step apps read.`,
	],
	keys: [{ title: "Keys", keymap: HUB_KEYS }],
	run: (args, carried) => {
		const distro = DISTROS.find((d) => d.osName === args["os-name"]);
		if (!distro) throw new UsageError("--os-name names the distro being installed");
		return (
			<HubScreen
				distro={distro}
				live={liveFrom(args)}
				notice={(carried as Carried | undefined)?.notice ?? null}
			/>
		);
	},
	// The screen hands off the step's action; the hub runs it and shows itself again.
	afterExit: (action, args): Carried | undefined => {
		if (!action) return undefined;
		const notice = runAction(action as Action, liveFrom(args));
		process.stdout.write("\x1b[2J\x1b[H");
		return { notice };
	},
});
