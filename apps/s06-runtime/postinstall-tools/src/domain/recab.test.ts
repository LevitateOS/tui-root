import { describe, expect, it } from "bun:test";
import { parseRecabStatusJson } from "./recab";

describe("parseRecabStatusJson", () => {
	it("parses a valid recab status payload", () => {
		const input = JSON.stringify({
			active_slot: "A",
			inactive_slot: "B",
			trial_pending: true,
			next_boot: "B",
			default_slot: "A",
			known_good_slot: "A",
			entry_prefix: "iuppiter",
		});
		const parsed = parseRecabStatusJson(input);
		expect(parsed).not.toBeNull();
		expect(parsed?.activeSlot).toBe("A");
		expect(parsed?.trialPending).toBe(true);
		expect(parsed?.nextBoot).toBe("B");
	});

	it("rejects malformed payloads", () => {
		expect(parseRecabStatusJson("nope")).toBeNull();
		expect(parseRecabStatusJson(JSON.stringify({}))).toBeNull();
		expect(
			parseRecabStatusJson(
				JSON.stringify({
					active_slot: "A",
					inactive_slot: "B",
					trial_pending: "yes",
					next_boot: null,
					default_slot: "A",
					known_good_slot: "A",
					entry_prefix: "iuppiter",
				}),
			),
		).toBeNull();
	});
});
