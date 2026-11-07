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

/** Keys on the mode-selection page. */
export const MODE_KEYS = [
	{
		action: "toggle",
		keys: ["m", "left", "h", "right", "l", "up", "k", "down", "j"],
		hint: "m/arrows",
		label: "switch mode",
	},
] as const satisfies Keymap;

/** Keys on the destructive-confirm page; everything else typed goes into the token. */
export const CONFIRM_KEYS = [
	{ action: "apply", keys: ["enter"], label: `apply (after typing ${CONFIRM_TOKEN})` },
	{ action: "erase", keys: ["backspace", "delete"], label: "erase" },
] as const satisfies Keymap;

/** Scrolls a page taller than its pane, from either pane (not while typing the token). */
export const SCROLL_KEYS = [
	{
		action: "scroll",
		keys: ["b", "C-u", "pageup", "space", "C-d", "pagedown"],
		hint: "space/b",
		label: "scroll page",
	},
] as const satisfies Keymap;

/** Of the two-way SCROLL_KEYS, the ones that scroll up. */
export const SCROLL_UP = new Set(["b", "C-u", "pageup"]);
