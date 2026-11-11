import type { Keymap } from "@levitate/tui-kit";

/** Keys while nothing is being asked. */
export const MAIN_KEYS = [
	{
		action: "move",
		keys: ["up", "k", "down", "j"],
		back: ["up", "k"],
		hint: "j/k",
		label: "select",
	},
	{ action: "run", keys: ["enter"], label: "run it" },
	{ action: "set_next", keys: ["t"], label: "go to: try the other slot" },
	{ action: "commit", keys: ["c"], label: "go to: commit" },
	{ action: "rollback", keys: ["x"], label: "go to: roll back" },
	{ action: "update_media", keys: ["s"], label: "go to: merge a release manifest" },
	{ action: "prepare", keys: ["p"], label: "prepare" },
	{ action: "finalize", keys: ["f"], label: "finalize" },
	{ action: "update_check", keys: ["u"], label: "check updates" },
	{ action: "reboot", keys: ["R"], label: "go to: reboot" },
	{ action: "overview", keys: ["o"], label: "go to: overview" },
	{ action: "history", keys: ["H"], label: "go to: history" },
	{ action: "refresh", keys: ["r"], label: "read again" },
	{ action: "quit", keys: ["q", "escape", "C-c"], hint: "q", label: "quit" },
] as const satisfies Keymap;

/** The MAIN_KEYS the footer shows; the rest are in `--help` and on the rail. */
export const FOOTER_ACTIONS: readonly (typeof MAIN_KEYS)[number]["action"][] = [
	"move",
	"run",
	"refresh",
	"quit",
];

/** Keys while a change waits for a yes. */
export const CONFIRM_KEYS = [
	{ action: "yes", keys: ["y", "enter"], hint: "y", label: "run it" },
	{ action: "no", keys: ["n", "escape"], hint: "n/Esc", label: "cancel" },
] as const satisfies Keymap;

/** Keys while a path or a slot's name is typed; everything else typed goes in. */
export const TEXT_KEYS = [
	{ action: "accept", keys: ["enter"], label: "accept" },
	{ action: "complete", keys: ["tab"], label: "complete the path" },
	{ action: "erase", keys: ["backspace", "delete"], label: "erase" },
	{ action: "cancel", keys: ["escape"], label: "cancel" },
] as const satisfies Keymap;
