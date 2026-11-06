import { SLOTS, type Slot, type Status } from "../generated/recab";

/**
 * Read `recab status --json`. recab prints it from the Rust type the
 * contract is generated from, so only its shape is confirmed here.
 */
export function parseRecabStatusJson(input: string): Status | null {
	try {
		const value = JSON.parse(input) as Partial<Status> | null;
		return value && SLOTS.includes(value.active_slot as Slot) ? (value as Status) : null;
	} catch {
		return null;
	}
}

export function formatSlot(value: Slot | null): string {
	return value ?? "(none)";
}
