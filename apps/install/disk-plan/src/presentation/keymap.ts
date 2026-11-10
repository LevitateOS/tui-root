import type { Keymap } from "@levitate/tui-kit";

/** Keys on every page. */
export const GLOBAL_KEYS = [
	{ action: "quit", keys: ["q", "escape", "C-c"], hint: "q", label: "quit" },
	{ action: "focus", keys: ["tab", "S-tab"], hint: "Tab", label: "switch pane" },
	{ action: "failure", keys: ["F"], label: "last failure" },
	{ action: "refresh", keys: ["R"], label: "read again" },
] as const satisfies Keymap;

/** Keys while the page list has focus. */
export const NAV_KEYS = [
	{
		action: "page",
		keys: ["down", "j", "right", "l", "up", "k", "left", "h"],
		hint: "j/k",
		label: "step",
	},
	{ action: "open", keys: ["enter"], label: "go on" },
] as const satisfies Keymap;

/** Keys while a page's content has focus. */
export const CONTENT_KEYS = [
	{ action: "next", keys: ["enter", "n"], label: "continue" },
	{ action: "back", keys: ["p"], label: "back" },
] as const satisfies Keymap;

/** Extra content keys on the target-disk page. */
export const DISK_KEYS = [
	{
		action: "move",
		keys: ["up", "k", "down", "j", "left", "h", "right", "l"],
		hint: "↑/↓",
		label: "select",
	},
] as const satisfies Keymap;

/** Keys on the two pages that choose one of two (the system, the disk's use). */
export const PICK_KEYS = [
	{
		action: "pick",
		keys: ["left", "h", "up", "k", "right", "l", "down", "j"],
		hint: "arrows/hjkl",
		label: "choose",
	},
] as const satisfies Keymap;

/** Of PICK_KEYS, the ones that pick the first choice. */
export const PICK_FIRST = new Set(["left", "h", "up", "k"]);

/** Keys on the partition editor page. */
export const PARTITION_KEYS = [
	{ action: "select", keys: ["up", "k", "down", "j"], hint: "↑/↓", label: "select" },
	{ action: "setup", keys: ["a"], label: "set up" },
	{ action: "room", keys: ["s"], label: "make room" },
	{ action: "create", keys: ["n"], label: "new" },
	{ action: "remove", keys: ["d"], label: "remove" },
	{ action: "resize", keys: ["r"], label: "resize" },
	{ action: "format", keys: ["f"], label: "format" },
	{ action: "role", keys: ["m"], label: "use as" },
	{ action: "clear", keys: ["x"], label: "leave" },
	{ action: "table", keys: ["W"], label: "new table" },
	{ action: "undo", keys: ["u"], label: "undo" },
	{ action: "reset", keys: ["U"], label: "undo all" },
	{ action: "next", keys: ["enter"], label: "go on" },
	{ action: "back", keys: ["p"], label: "back" },
] as const satisfies Keymap;

/** Keys while making room: the divider between a partition and the space it gives up;
 * typed text is how much room to make. */
export const ROOM_KEYS = [
	{ action: "step", keys: ["left", "h", "right", "l"], hint: "←/→", label: "more/less room" },
	{ action: "ends", keys: ["home", "end"], hint: "Home/End", label: "most/least room" },
	{ action: "accept", keys: ["enter"], label: "shrink it" },
	{ action: "erase", keys: ["backspace", "delete"], label: "erase" },
	{ action: "cancel", keys: ["escape"], label: "cancel" },
] as const satisfies Keymap;

/** Of ROOM_KEYS' steps, the ones that make more room. */
export const MORE_ROOM = new Set(["left", "h"]);

/** Keys while the editor asks to pick one of a list. */
export const CHOICE_KEYS = [
	{ action: "move", keys: ["up", "k", "down", "j"], hint: "↑/↓", label: "choose" },
	{ action: "accept", keys: ["enter"], label: "accept" },
	{ action: "cancel", keys: ["escape"], label: "cancel" },
] as const satisfies Keymap;

/** Keys while the editor asks for a size or a name; everything else typed goes in. */
export const TEXT_KEYS = [
	{ action: "accept", keys: ["enter"], label: "accept" },
	{ action: "erase", keys: ["backspace", "delete"], label: "erase" },
	{ action: "cancel", keys: ["escape"], label: "cancel" },
] as const satisfies Keymap;

/** Keys on the destructive-confirm page; everything else typed goes into the token. */
export const CONFIRM_KEYS = [
	{ action: "apply", keys: ["enter"], label: "write, once unlocked" },
	{ action: "erase", keys: ["backspace", "delete"], label: "erase" },
] as const satisfies Keymap;
