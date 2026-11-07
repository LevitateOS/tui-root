import type { Keymap } from "@levitate/tui-kit";
import { CONFIRM_TOKEN } from "../generated/recpart";

/** Keys on every page. */
export const GLOBAL_KEYS = [
	{ action: "quit", keys: ["q", "escape", "C-c"], hint: "q", label: "quit" },
	{ action: "focus", keys: ["tab", "S-tab"], hint: "Tab", label: "switch pane" },
	{ action: "failure", keys: ["F"], label: "show last failure" },
] as const satisfies Keymap;

/** Keys while the page list has focus. */
export const NAV_KEYS = [
	{
		action: "page",
		keys: ["down", "j", "right", "l", "up", "k", "left", "h"],
		hint: "j/k",
		label: "next/prev page",
	},
	{ action: "open", keys: ["enter"], label: "work on this page" },
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
		hint: "arrows/hjkl",
		label: "choose disk",
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
	{ action: "create", keys: ["n"], label: "new partition" },
	{ action: "remove", keys: ["d"], label: "delete" },
	{ action: "resize", keys: ["r"], label: "resize" },
	{ action: "format", keys: ["f"], label: "format" },
	{ action: "role", keys: ["m"], label: "use as (role)" },
	{ action: "clear", keys: ["x"], label: "leave as is" },
	{ action: "table", keys: ["W"], label: "new partition table (erase all)" },
	{ action: "undo", keys: ["u"], label: "undo" },
	{ action: "reset", keys: ["U"], label: "undo all" },
	{ action: "next", keys: ["enter"], label: "continue" },
	{ action: "back", keys: ["p"], label: "back" },
] as const satisfies Keymap;

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
	{ action: "apply", keys: ["enter"], label: `apply (after typing ${CONFIRM_TOKEN})` },
	{ action: "erase", keys: ["backspace", "delete"], label: "erase" },
] as const satisfies Keymap;
