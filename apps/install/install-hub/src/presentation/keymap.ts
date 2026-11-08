import type { Keymap } from "@levitate/tui-kit";

export const HUB_KEYS = [
	{
		action: "move",
		keys: ["up", "k", "down", "j"],
		back: ["up", "k"],
		hint: "j/k",
		label: "choose a step",
	},
	{ action: "start", keys: ["enter"], label: "do this step" },
	// Not `m`: the docs pane beside the hub uses it for its sidebar mode.
	{ action: "mark", keys: ["d"], label: "mark this step done" },
	{ action: "shell", keys: ["s"], label: "shell (exit returns here)" },
	{ action: "focus", keys: ["tab", "S-tab"], hint: "Tab", label: "switch pane" },
	{ action: "quit", keys: ["q", "C-c"], hint: "q", label: "quit" },
] as const satisfies Keymap;
