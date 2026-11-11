import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { runCommand } from "@levitate/tui-kit";
import type { Status } from "../generated/recab";
import { parseRecabStatusJson, recabError, type RecabError } from "../domain/recab";

export const STATUS_ARGV: readonly string[] = ["recab", "status", "--json"];

export type StatusRead =
	| { kind: "reading" }
	| { kind: "ok"; status: Status }
	| { kind: "failed"; error: RecabError };

/** recab's slot status, or why there is none. */
export async function readRecabStatus(): Promise<StatusRead> {
	const result = await runCommand(STATUS_ARGV);
	if (result.exitCode !== 0) return { kind: "failed", error: recabError(result) };
	const status = parseRecabStatusJson(result.stdout);
	return status
		? { kind: "ok", status }
		: {
				kind: "failed",
				error: {
					tag: null,
					message: "recab status printed JSON of another shape",
					help: "Install matching versions of recab and the system interface.",
				},
			};
}

/** Completes `text` as far as the paths it could be agree, as a shell's Tab does. */
export function completePath(text: string): string {
	if (!text) return text;
	const dir = text.endsWith("/") ? text : dirname(text);
	const prefix = text.slice(dir.length).replace(/^\//, "");
	let names: string[];
	try {
		names = readdirSync(dir || ".").filter((name) => name.startsWith(prefix));
	} catch {
		return text;
	}
	if (names.length === 0) return text;
	let common = names[0]!;
	for (const name of names) while (!name.startsWith(common)) common = common.slice(0, -1);
	const completed = join(dir, common);
	if (names.length === 1) {
		try {
			if (statSync(completed).isDirectory()) return `${completed}/`;
		} catch {
			// A dangling link completes like a file.
		}
	}
	return completed.length > text.length ? completed : text;
}
