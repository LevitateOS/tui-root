/** Commands and verdicts come from recab; this module only presents them. */
import type { Operation, Status } from "../generated/recab";
export type ActionId = string;
export const ACTION_IDS = [
	"prepare",
	"install",
	"edit",
	"update_check",
	"update_download",
	"update_apply",
	"finalize",
	"set_next",
	"commit",
	"rollback",
	"reboot",
];
export function actionIds(s: Status | null): string[] {
	return s ? [...s.operations.map((o) => o.id), "reboot"] : ACTION_IDS;
}
export const TAKES_MACHINE_DOWN: Record<string, boolean> = { reboot: true };
export type Verdict = { kind: "ready" } | { kind: "refused" | "no-change"; reason: string };
export type Change = { what: string; before: string; after: string };
export type ActionPlan = {
	id: string;
	label: string;
	title: string;
	summary: string;
	verdict: Verdict;
	changes: Change[];
	destructive: boolean;
	argv: readonly string[];
	inputs: Operation["inputs"];
	bar: string;
	done: string;
	followUp: string | null;
};
export function planAction(id: string, s: Status): ActionPlan {
	const op = s.operations.find((o) => o.id === id);
	const label = id === "reboot" ? "Reboot" : (op?.label ?? id);
	return {
		id,
		label,
		title: label,
		summary:
			id === "reboot"
				? `Restart into slot ${s.next_boot ?? "selected by firmware"}.`
				: s.preparation?.slot === s.active_slot
					? `The candidate is running on trial in ${s.active_slot}. Protected system: ${s.inactive_slot}.`
					: `Running: ${s.active_slot}. Prepared changes remain in ${s.inactive_slot} until trial boot.`,
		verdict:
			id === "reboot"
				? { kind: "ready" }
				: op?.verdict === "ready"
					? { kind: "ready" }
					: {
							kind: op?.verdict === "no_change" ? "no-change" : "refused",
							reason:
								op?.reason ??
								(op?.verdict === "no_change"
									? "Already in this state"
									: "recab did not offer this operation"),
						},
		changes: [],
		destructive: op?.destructive ?? false,
		argv:
			id === "reboot"
				? ["reboot"]
				: ["recab", "--json", "--machine-events", "--actor", "person", ...(op?.argv ?? [])],
		inputs: op?.inputs ?? [],
		bar: label,
		done: "Operation completed. Review the refreshed system state.",
		followUp: id === "finalize" ? "set_next" : id === "set_next" ? "reboot" : null,
	};
}
export function operationArgv(plan: ActionPlan, answers: Record<string, string>): string[] {
	const argv = [...plan.argv];
	for (const field of plan.inputs) {
		const value = answers[field.name]?.trim();
		if (value) {
			if (field.flag) argv.push(field.flag);
			argv.push(value);
		}
	}
	return argv;
}
export const STATUS_ROWS: ReadonlyArray<[string, (s: Status) => string]> = [
	["Running", (s) => s.active_slot],
	["Next boot", (s) => s.next_boot ?? "none"],
	["Lifecycle", (s) => s.lifecycle.state],
];
