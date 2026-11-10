/** Which family each keymap belongs to, from where its file lies under the keymaps
 * directory (`.../i386/qwertz/de.map.gz` is a qwertz map): the target's, else the live
 * system's. */
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { familyOf } from "../domain/keyboard";

const KEYMAP_DIRECTORIES = [
	"usr/share/kbd/keymaps",
	"usr/lib/kbd/keymaps",
	"usr/share/keymaps",
	"lib/kbd/keymaps",
];

/** A keymap file's name, without the suffixes kbd's files carry. */
function mapName(file: string): string | null {
	const name = file.replace(/\.(map|kmap|inc)(\.(gz|xz|zst|bz2))?$/, "");
	return name === file ? null : name;
}

/** Every map under `directory`, by name, with the directory it lies in. A directory kbd
 * names a family wins over any other. */
function walk(directory: string, found: Map<string, string>): void {
	let entries;
	try {
		entries = readdirSync(directory, { withFileTypes: true });
	} catch {
		return;
	}
	const parent = basename(directory);
	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (entry.name !== "include") walk(path, found);
			continue;
		}
		const name = mapName(entry.name);
		if (!name) continue;
		const before = found.get(name);
		if (before === undefined || (familyOf(before) === null && familyOf(parent) !== null))
			found.set(name, parent);
	}
}

function read(root: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const directory of KEYMAP_DIRECTORIES) walk(join(root, directory), found);
	return found;
}

/** The family of each keymap, by name: the target's tables first, then the live system's. */
export type KeymapFamilies = (keymap: string) => string | null;

export function readKeymapFamilies(root: string): KeymapFamilies {
	const target = read(root);
	let live: Map<string, string> | null = null;
	return (keymap) => {
		const directory = target.get(keymap) ?? (live ??= read("/")).get(keymap);
		return directory ? familyOf(directory) : null;
	};
}
