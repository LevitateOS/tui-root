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
  /** recab arguments. */
  args: string[];
  hotkey: string;
};

export const RUNTIME_RECAB_ACTIONS: ReadonlyArray<RuntimeRecabAction> = [
  {
    id: "status-refresh",
    section: "Read",
    label: "Refresh status",
    description: "Run recab status --json and refresh slot view",
    args: ["status", "--json"],
    hotkey: "r",
  },
  {
    id: "set-next-a",
    section: "Mutating",
    label: "Set next boot -> A",
    description: "Stage one-shot trial boot to slot A",
    args: ["set-next", "A"],
    hotkey: "a",
  },
  {
    id: "set-next-b",
    section: "Mutating",
    label: "Set next boot -> B",
    description: "Stage one-shot trial boot to slot B",
    args: ["set-next", "B"],
    hotkey: "b",
  },
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
