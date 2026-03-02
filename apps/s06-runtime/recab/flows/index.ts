import type { RecabCommandSpec } from "../domain";

export type RuntimeRecabActionId =
	| "status-refresh"
	| "set-next-a"
	| "set-next-b"
	| "commit"
	| "rollback";

export type RuntimeRecabAction = {
	id: RuntimeRecabActionId;
	section: "Read" | "Mutating";
	label: string;
	description: string;
	command: RecabCommandSpec;
	hotkeyHint: string;
};

export const RUNTIME_RECAB_ACTIONS: ReadonlyArray<RuntimeRecabAction> = [
	{
		id: "status-refresh",
		section: "Read",
		label: "Refresh status",
		description: "Run recab status --json and refresh slot view",
		command: { command: "status", args: ["status", "--json"] },
		hotkeyHint: "r",
	},
	{
		id: "set-next-a",
		section: "Mutating",
		label: "Set next boot -> A",
		description: "Stage one-shot trial boot to slot A",
		command: { command: "set-next", args: ["set-next", "A"] },
		hotkeyHint: "a",
	},
	{
		id: "set-next-b",
		section: "Mutating",
		label: "Set next boot -> B",
		description: "Stage one-shot trial boot to slot B",
		command: { command: "set-next", args: ["set-next", "B"] },
		hotkeyHint: "b",
	},
	{
		id: "commit",
		section: "Mutating",
		label: "Commit active slot",
		description: "Mark current slot as known-good + default",
		command: { command: "commit", args: ["commit"] },
		hotkeyHint: "c",
	},
	{
		id: "rollback",
		section: "Mutating",
		label: "Rollback to known-good",
		description: "Set next/default target back to known-good slot",
		command: { command: "rollback", args: ["rollback"] },
		hotkeyHint: "x",
	},
];
