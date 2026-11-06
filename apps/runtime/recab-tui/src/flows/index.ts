import type { Keymap } from "@levitate/tui-kit";
import { SLOTS, type Slot } from "../generated/recab";

export type RuntimeRecabActionId =
	| "status-refresh"
	| `set-next-${Lowercase<Slot>}`
	| "commit"
	| "rollback";

/** `recab status --json`, the read the screen refreshes from. */
export const STATUS_ARGS: ReadonlyArray<string> = ["status", "--json"];

export type RuntimeRecabAction = {
	id: RuntimeRecabActionId;
	section: "Read" | "Mutating";
	label: string;
	description: string;
	/** recab arguments. */
	args: ReadonlyArray<string>;
	hotkey: string;
};

export const RUNTIME_RECAB_ACTIONS: ReadonlyArray<RuntimeRecabAction> = [
	{
		id: "status-refresh",
		section: "Read",
		label: "Refresh status",
		description: "Run recab status --json and refresh slot view",
		args: STATUS_ARGS,
		hotkey: "r",
	},
	...SLOTS.map((slot) => ({
		id: `set-next-${slot.toLowerCase() as Lowercase<Slot>}` as const,
		section: "Mutating" as const,
		label: `Set next boot -> ${slot}`,
		description: `Stage one-shot trial boot to slot ${slot}`,
		args: ["set-next", slot],
		hotkey: slot.toLowerCase(),
	})),
	{
		id: "commit",
		section: "Mutating",
		label: "Commit active slot",
		description: "Mark current slot as known-good + default",
		args: ["commit"],
		hotkey: "c",
	},
	{
		id: "rollback",
		section: "Mutating",
		label: "Rollback to known-good",
		description: "Set next/default target back to known-good slot",
		args: ["rollback"],
		hotkey: "x",
	},
];

/** Every key the screen binds; the footer and `--help` are drawn from it. */
export const RECAB_KEYMAP = [
	{ action: "move", keys: ["down", "j", "up", "k"], hint: "j/k", label: "select action" },
	{ action: "run", keys: ["enter"], label: "run selected" },
	...RUNTIME_RECAB_ACTIONS.map((action) => ({
		action: action.id,
		keys: [action.hotkey],
		label: action.label,
	})),
	{ action: "quit", keys: ["q", "escape", "C-c"], hint: "q", label: "quit" },
] as const satisfies Keymap;

export type RecabKeyAction = (typeof RECAB_KEYMAP)[number]["action"];
