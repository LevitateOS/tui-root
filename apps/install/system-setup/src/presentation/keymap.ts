import type { Keymap } from "@levitate/tui-kit";

/** Keys while nothing is being asked. */
export const MAIN_KEYS = [
	{ action: "move", keys: ["up", "k", "down", "j"], back: ["up", "k"], hint: "j/k", label: "page" },
	{ action: "go", keys: ["enter"], label: "answer" },
	{ action: "again", keys: ["r"], label: "read again" },
	{ action: "quit", keys: ["q", "escape", "C-c"], hint: "q", label: "back" },
] as const satisfies Keymap;

/** Keys while a list is open; everything else typed narrows it. */
export const PICK_KEYS = [
	{ action: "move", keys: ["up", "down"], back: ["up"], hint: "↑/↓", label: "select" },
	{
		action: "page",
		keys: ["pageup", "pagedown"],
		back: ["pageup"],
		hint: "PgUp/PgDn",
		label: "page",
	},
	{ action: "accept", keys: ["enter"], label: "choose" },
	{ action: "erase", keys: ["backspace", "delete"], hint: "Bksp", label: "erase" },
	{ action: "cancel", keys: ["escape"], label: "cancel" },
] as const satisfies Keymap;

/** Keys while a name or a password is typed; everything else typed goes in. */
export const TEXT_KEYS = [
	{ action: "accept", keys: ["enter"], label: "accept" },
	{ action: "erase", keys: ["backspace", "delete"], hint: "Bksp", label: "erase" },
	{ action: "cancel", keys: ["escape"], label: "cancel" },
] as const satisfies Keymap;

/** Keys while the apply waits for a yes. */
export const CONFIRM_KEYS = [
	{ action: "yes", keys: ["y"], label: "apply" },
	{ action: "no", keys: ["n", "escape"], hint: "n/Esc", label: "not yet" },
] as const satisfies Keymap;
