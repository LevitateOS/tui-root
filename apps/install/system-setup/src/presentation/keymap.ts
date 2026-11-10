import type { Keymap } from "@levitate/tui-kit";

/** Keys while nothing is being asked. */
export const MAIN_KEYS = [
	{ action: "move", keys: ["up", "k", "down", "j"], back: ["up", "k"], hint: "j/k", label: "step" },
	{ action: "go", keys: ["enter"], label: "go on" },
	{ action: "quit", keys: ["q", "escape", "C-c"], hint: "q", label: "back" },
] as const satisfies Keymap;

/** Reading the system or the plan again; the action bar offers it where it matters. */
export const AGAIN_KEYS = [
	{ action: "again", keys: ["r"], label: "read again" },
] as const satisfies Keymap;

/** Keys on the review page, where the answers are a card: a number jumps to its
 * question and space turns the page to the commands. `turn` says what it turns to. */
export function reviewKeys(turn: string): Keymap {
	return [
		{
			action: "pick",
			keys: ["1", "2", "3", "4", "5", "6"],
			hint: "1-6",
			label: "change an answer",
		},
		{ action: "turn", keys: ["space"], label: turn },
		{ action: "go", keys: ["enter"], label: "apply" },
		{ action: "quit", keys: ["q", "escape", "C-c"], hint: "q", label: "back" },
	];
}

/** Keys while a list is open; everything else typed narrows it. */
export const PICK_KEYS = [
	{ action: "move", keys: ["up", "down"], back: ["up"], hint: "↑/↓", label: "select" },
	{ action: "accept", keys: ["enter"], label: "choose" },
	{ action: "erase", keys: ["backspace", "delete"], hint: "Bksp", label: "erase" },
	{ action: "cancel", keys: ["escape"], label: "cancel" },
] as const satisfies Keymap;

/** Paging a long list, which the list's footer leaves out. */
export const PAGE_KEYS = [
	{
		action: "page",
		keys: ["pageup", "pagedown"],
		back: ["pageup"],
		hint: "PgUp/PgDn",
		label: "page",
	},
] as const satisfies Keymap;

/** The keyboard list: Tab moves to the line to try the layout on, and back. */
export const KEYBOARD_KEYS = [
	...PICK_KEYS,
	{ action: "try", keys: ["tab"], label: "try it" },
] as const satisfies Keymap;

/** Keys while a name or a password is typed; everything else typed goes in. */
export const TEXT_KEYS = [
	{ action: "accept", keys: ["enter"], label: "accept" },
	{ action: "erase", keys: ["backspace", "delete"], hint: "Bksp", label: "erase" },
	{ action: "cancel", keys: ["escape"], label: "cancel" },
] as const satisfies Keymap;

/** Keys while the apply waits for a yes. */
export const CONFIRM_KEYS = [
	{ action: "yes", keys: ["y"], label: "yes" },
	{ action: "no", keys: ["n", "escape"], hint: "n", label: "no" },
] as const satisfies Keymap;
