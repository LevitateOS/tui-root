import type { Keymap } from "@levitate/tui-kit";

/** Keys while nothing is being asked. */
export const MAIN_KEYS = [
	{ action: "move", keys: ["up", "k", "down", "j"], hint: "j/k", label: "page" },
	{ action: "go", keys: ["enter"], label: "do this step, or go on" },
	{ action: "again", keys: ["r"], label: "check again / read the mounts again" },
	{ action: "quit", keys: ["q", "escape", "C-c"], hint: "q", label: "back to the install steps" },
] as const satisfies Keymap;

/** Keys while the fstab write waits for a yes to replace lines already there. */
export const CONFIRM_KEYS = [
	{ action: "yes", keys: ["y"], label: "replace them" },
	{ action: "no", keys: ["n", "escape"], hint: "n/Esc", label: "keep the file as it is" },
] as const satisfies Keymap;
