import type { Keymap } from "@levitate/tui-kit";

export const HUB_KEYS = [
	{
		action: "move",
		keys: ["up", "k", "down", "j"],
		back: ["up", "k"],
		hint: "j/k",
		label: "step",
	},
	{ action: "start", keys: ["enter"], label: "do it" },
	// Not `m`: the docs pane beside the hub uses it for its sidebar mode.
	{ action: "mark", keys: ["d"], label: "mark done" },
	{ action: "shell", keys: ["s"], label: "shell" },
	{ action: "focus", keys: ["tab", "S-tab"], hint: "Tab", label: "switch pane" },
	{ action: "quit", keys: ["q", "C-c"], hint: "q", label: "quit" },
] as const satisfies Keymap;
