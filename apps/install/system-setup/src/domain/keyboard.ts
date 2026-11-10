/**
 * What a keymap looks like on the keyboard card: the family of layouts it belongs to
 * (kbd keeps its maps in directories named for it) and the letter rows of that family.
 */

/** The directories kbd sorts its keymaps into. */
const FAMILIES = [
	"azerty",
	"bepo",
	"carpalx",
	"colemak",
	"dvorak",
	"fgGIod",
	"neo",
	"olpc",
	"qwerty",
	"qwertz",
] as const;

/** The three letter rows of the families whose letters are plain ASCII. */
const ROWS: Record<string, readonly (readonly string[])[]> = {
	qwerty: [
		["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
		["a", "s", "d", "f", "g", "h", "j", "k", "l"],
		["z", "x", "c", "v", "b", "n", "m"],
	],
	qwertz: [
		["q", "w", "e", "r", "t", "z", "u", "i", "o", "p"],
		["a", "s", "d", "f", "g", "h", "j", "k", "l"],
		["y", "x", "c", "v", "b", "n", "m"],
	],
	azerty: [
		["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
		["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
		["w", "x", "c", "v", "b", "n", ","],
	],
	dvorak: [
		["'", ",", ".", "p", "y", "f", "g", "c", "r", "l"],
		["a", "o", "e", "u", "i", "d", "h", "t", "n", "s"],
		[";", "q", "j", "k", "x", "b", "m"],
	],
	colemak: [
		["q", "w", "f", "p", "g", "j", "l", "u", "y", ";"],
		["a", "r", "s", "t", "d", "h", "n", "e", "i", "o"],
		["z", "x", "c", "v", "b", "k", "m"],
	],
};

/** Layouts that differ from QWERTY in more keys than this show no marks: marking most
 * of the keyboard says nothing. */
const MOST_MARKED = 5;

/** The family a directory name stands for, when it is one of kbd's. */
export function familyOf(directory: string): string | null {
	return FAMILIES.find((name) => name.toLowerCase() === directory.toLowerCase()) ?? null;
}

export type KeyRow = { key: string; differs: boolean }[];

/** The letter rows of `family`, each key with whether it differs from QWERTY's; null for
 * a family whose letters are not known here. */
export function keyRows(family: string | null): KeyRow[] | null {
	const rows = family ? ROWS[family.toLowerCase()] : undefined;
	const base = ROWS.qwerty!;
	if (!rows) return null;
	const marked = rows.map((row, r) =>
		row.map((key, c) => key !== base[r]![c] && c < base[r]!.length),
	);
	const count = marked.flat().filter(Boolean).length;
	return rows.map((row, r) =>
		row.map((key, c) => ({ key, differs: count <= MOST_MARKED && marked[r]![c]! })),
	);
}
