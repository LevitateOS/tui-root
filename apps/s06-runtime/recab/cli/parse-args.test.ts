import { describe, expect, it } from "bun:test";
import { parseCliArgs } from "./parse-args";

describe("parseCliArgs", () => {
	it("uses default recab binary when unset", () => {
		const parsed = parseCliArgs([]);
		expect(parsed.error).toBeNull();
		expect(parsed.help).toBe(false);
		expect(parsed.recabBin).toBe("recab");
	});

	it("parses --recab-bin", () => {
		const parsed = parseCliArgs(["--recab-bin", "/usr/local/bin/recab"]);
		expect(parsed.error).toBeNull();
		expect(parsed.recabBin).toBe("/usr/local/bin/recab");
	});

	it("fails on unknown args", () => {
		const parsed = parseCliArgs(["--wat"]);
		expect(parsed.error).toBe("unknown argument: --wat");
	});
});
