import { PAGE_SCROLL_KEYS, type Keymap } from "@levitate/tui-kit";

/** The kit's page scroll (the other apps on the install screen scroll the same way). */
const PAGE_SCROLL = { ...PAGE_SCROLL_KEYS[0], action: "pageScroll" } as const;

/** Keys that work in either pane. */
export const VIEWER_KEYS = [
	{ action: "quit", keys: ["q", "C-c"], hint: "q", label: "quit" },
	{ action: "focus", keys: ["tab", "S-tab"], hint: "Tab", label: "switch pane" },
	{ action: "sidebarMode", keys: ["m"], label: "sidebar mode" },
] as const satisfies Keymap;

/** Keys while the page list has focus. */
export const NAV_KEYS = [
	{
		action: "page",
		keys: ["left", "h", "right", "l"],
		back: ["left", "h"],
		hint: "h/l",
		label: "prev/next page",
	},
	{
		action: "section",
		keys: ["[", "{", "]", "}"],
		back: ["[", "{"],
		hint: "[/]",
		label: "prev/next section",
	},
	{
		action: "scroll",
		keys: ["up", "k", "down", "j"],
		back: ["up", "k"],
		hint: "j/k",
		label: "scroll content",
	},
	PAGE_SCROLL,
] as const satisfies Keymap;

/** Keys while the page content has focus. */
export const CONTENT_KEYS = [
	{
		action: "action",
		keys: ["down", "j", "up", "k"],
		back: ["up", "k"],
		hint: "j/k",
		label: "next/prev action",
	},
	{ action: "activate", keys: ["enter"], label: "open link / copy" },
	{ action: "copy", keys: ["c", "y"], label: "copy" },
	PAGE_SCROLL,
	{ action: "top", keys: ["g", "home"], label: "top" },
	{ action: "bottom", keys: ["G", "end"], label: "end" },
] as const satisfies Keymap;
