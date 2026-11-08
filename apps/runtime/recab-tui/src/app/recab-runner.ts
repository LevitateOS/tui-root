import { closeSync, openSync, readdirSync, readSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { errorMessage, runCommand } from "@levitate/tui-kit";
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
					help: "recab and recab-tui come from different versions; regenerate src/generated/recab.ts.",
				},
			};
}

/** The EROFS superblock's magic, a little-endian u32 at byte 1024 (as recab checks). */
const EROFS_MAGIC = 0xe0f5e1e2;

/** Whether the file or partition at `path` starts like an EROFS image; null when it
 * can't be read (a partition needs root), so recab decides. */
function isErofs(path: string): boolean | null {
	try {
		const fd = openSync(path, "r");
		try {
			const buffer = Buffer.alloc(4);
			return readSync(fd, buffer, 0, 4, 1024) === 4 && buffer.readUInt32LE(0) === EROFS_MAGIC;
		} finally {
			closeSync(fd);
		}
	} catch {
		return null;
	}
}

/** What is at `path` (relative to the working directory, or absolute): a file, a block
 * device (a partition holding an image), an EROFS image for `image`, or why not. */
export function checkPath(path: string, want: "image" | "file"): string | null {
	const full = resolve(path);
	try {
		const stat = statSync(full);
		if (!stat.isFile() && !(want === "image" && stat.isBlockDevice()))
			return want === "image" ? "not a file or a partition" : "not a file";
	} catch (error) {
		// Only a missing path is "doesn't exist"; anything else (EACCES, ELOOP) says what it is.
		return (error as NodeJS.ErrnoException).code === "ENOENT" ? "doesn't exist" : errorMessage(error);
	}
	if (want === "image" && isErofs(full) === false)
		return "not an EROFS image (no EROFS superblock); pass the system's .erofs image";
	return null;
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
