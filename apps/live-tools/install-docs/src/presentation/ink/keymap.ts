import type { Keymap } from "@levitate/tui-kit";

/** Keys that work in either pane. */
export const VIEWER_KEYS = [
	{ action: "quit", keys: ["q", "escape", "C-c"], hint: "q", label: "quit" },
	{ action: "focus", keys: ["tab", "S-tab"], hint: "Tab", label: "switch pane" },
	{ action: "sidebarMode", keys: ["m"], label: "sidebar mode" },
] as const satisfies Keymap;

/** Keys while the page list has focus. */
export const NAV_KEYS = [
	{ action: "page", keys: ["left", "h", "right", "l"], hint: "h/l", label: "prev/next page" },
	{ action: "section", keys: ["[", "{", "]", "}"], hint: "[/]", label: "prev/next section" },
	{ action: "scroll", keys: ["up", "k", "down", "j"], hint: "j/k", label: "scroll content" },
] as const satisfies Keymap;

/** Keys while the page content has focus. */
export const CONTENT_KEYS = [
	{ action: "action", keys: ["down", "j", "up", "k"], hint: "j/k", label: "next/prev action" },
	{ action: "activate", keys: ["enter"], label: "open link / copy command" },
	{ action: "copy", keys: ["c", "y"], label: "copy action" },
	{
		action: "pageScroll",
		keys: ["pageup", "b", "pagedown", "space"],
		hint: "PgUp/PgDn",
		label: "scroll a page",
	},
	{ action: "top", keys: ["g", "home"], label: "top" },
	{ action: "bottom", keys: ["G", "end"], label: "end" },
] as const satisfies Keymap;

/** Backward keys of the two-way bindings above. */
export const BACKWARD_KEYS = new Set(["left", "h", "[", "{", "up", "k", "pageup", "b"]);
