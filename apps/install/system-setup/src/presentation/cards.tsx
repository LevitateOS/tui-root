/**
 * The parts the pages are drawn with that the kit does not carry: the machine as a card,
 * the card beside each question, the strength line, the field with a faulty character
 * marked, and the commands in the order they run. Each is drawn cell by cell on a
 * `CellGrid`, so every cell is painted and every glyph names its colour.
 */
import type { ReactNode } from "react";
import {
	CellGrid,
	CellRows,
	textWidth,
	truncateLine,
	useSurfaceBackground,
	type ColorIntent,
	type PathState,
} from "@levitate/tui-kit";
import type { KeyRow } from "../domain/keyboard";
import type { LocaleFormats } from "../domain/locale";
import { FIELDS, PAGES, type Answers, type FieldId } from "../domain/setup";
import { worldMap, zoneClock, zoneParts, type ZonePlace, type ZonePlaces } from "../domain/zones";

/** Text broken at spaces into lines of at most `width` cells; a word wider than that is
 * cut into pieces. */
export function wrapWords(text: string, width: number): string[] {
	const room = Math.max(1, width);
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(" ")) {
		let rest = word;
		while (textWidth(rest) > room) {
			if (line) lines.push(line);
			let cut = "";
			for (const char of rest) {
				if (textWidth(cut + char) > room) break;
				cut += char;
			}
			lines.push(cut);
			rest = rest.slice(cut.length);
			line = "";
		}
		if (line && textWidth(line) + 1 + textWidth(rest) > room) {
			lines.push(line);
			line = rest;
		} else {
			line = line ? `${line} ${rest}` : rest;
		}
	}
	if (line) lines.push(line);
	return lines;
}

/** A card: ink on the content's night, `width` by `height` cells. */
function newCard(width: number, height: number): CellGrid {
	return new CellGrid(width, Math.max(1, height), "panelBackground");
}

/** Puts `text` at the card's right margin on `row`. */
function putRight(grid: CellGrid, row: number, text: string, fg: ColorIntent, bold = false): void {
	grid.put(row, Math.max(0, grid.width - 2 - textWidth(text)), text, fg, undefined, bold);
}

/** How many rows apart a card's lines sit: two when it is tall, else one. */
function spacing(height: number): number {
	return height >= 12 ? 2 : 1;
}

/** What each question's answer reads as on the machine card. */
export function answerText(
	field: FieldId,
	answers: Answers,
	answered: boolean,
	long: boolean,
): string {
	if (!answered) return "";
	switch (field) {
		case "root":
			return answers.rootPassword === null ? (long ? "none (root can't log in)" : "none") : "set";
		case "user":
			return answers.user === null ? "none" : `${answers.user}, an administrator`;
		default:
			return answers[field] ?? "left as the system has it";
	}
}

/**
 * The machine as a card of six lines: empty at the start, filled as the questions are
 * answered, whole at the end (then its bar is in the accent). `numbered` puts the key
 * that changes each line before it.
 */
export function MachineCard({
	width,
	answers,
	answered,
	system,
	numbered = false,
}: {
	width: number;
	answers: Answers;
	answered: Record<FieldId, boolean>;
	system: string | null;
	numbered?: boolean;
}): ReactNode {
	const grid = new CellGrid(width, 9, "panelBackground");
	const whole = FIELDS.every((field) => answered[field]);
	grid.fill(0, 0, width, whole ? "accent" : "panelBorder");
	grid.put(
		0,
		2,
		truncateLine(
			answered.hostname && answers.hostname ? answers.hostname : "this machine",
			width - 4,
		),
		whole ? "contentBackground" : "text",
		undefined,
		true,
	);
	if (system)
		putRight(grid, 0, truncateLine(system, width / 2), whole ? "contentBackground" : "dimText");
	const column = Math.floor(width / 2);
	FIELDS.forEach((field, i) => {
		let x = 2 + Math.floor(i / 3) * column;
		const row = 2 + (i % 3) * 2;
		if (numbered) {
			grid.put(row, x, String(i + 1), "faintText");
			x += 3;
		}
		const room = column - 3 - (numbered ? 3 : 0);
		const done = answered[field];
		grid.put(row, x, truncateLine(PAGES[field].short, room), "dimText");
		grid.put(
			row + 1,
			x,
			done ? truncateLine(answerText(field, answers, true, false), room) : "·".repeat(12),
			done ? "text" : "contentBorder",
			undefined,
			done,
		);
	});
	return <CellRows grid={grid} />;
}

/** A card with nothing in it, for a question with nothing to show yet. */
export function EmptyCard({ width, height }: { width: number; height: number }): ReactNode {
	return <CellRows grid={newCard(width, height)} />;
}

/**
 * The keyboard card: the layout's name and family, the letter rows of the family with
 * the keys that differ from QWERTY marked, and the line to try the layout on. `rows` is
 * null for a family not known here: no keys are drawn.
 */
export function KeyboardCard({
	width,
	height,
	name,
	family,
	rows,
	trying,
}: {
	width: number;
	height: number;
	name: string;
	family: string | null;
	rows: KeyRow[] | null;
	/** What has been typed on the try line; null while the list has the keys. */
	trying: string | null;
}): ReactNode {
	const grid = newCard(width, height);
	const label = family ? family.toUpperCase() : "";
	grid.put(
		1,
		2,
		truncateLine(name, Math.max(1, width - 5 - textWidth(label))),
		"text",
		undefined,
		true,
	);
	if (label) putRight(grid, 1, label, "dimText");
	const step = spacing(height);
	rows?.forEach((row, r) => {
		let col = 2 + r;
		for (const { key, differs } of row) {
			if (col + 3 > width) break;
			grid.put(
				3 + r * step,
				col,
				` ${key} `,
				differs ? "contentBackground" : "text",
				differs ? "highlight" : "raisedBackground",
				true,
			);
			col += 4;
		}
	});
	const line = height - 3;
	grid.fill(line, 2, Math.max(0, width - 4), "raisedBackground");
	let shown = trying ?? "";
	const room = Math.max(0, width - 4 - 3);
	while (textWidth(shown) > room) shown = [...shown].slice(1).join("");
	const after = grid.put(line, 3, shown, "text", "raisedBackground", true);
	if (trying !== null) grid.fill(line, after, 1, "accent");
	return <CellRows grid={grid} />;
}

/**
 * The time zone card: the city and its distance from UTC, the zone on a dotted map with
 * the zones the search found marked, and its clock now.
 */
export function ZoneCard({
	width,
	height,
	zone,
	found,
	places,
	now,
}: {
	width: number;
	height: number;
	zone: string;
	found: readonly ZonePlace[];
	places: ZonePlaces;
	now: Date;
}): ReactNode {
	const grid = newCard(width, height);
	const clock = zoneClock(zone, now);
	const { city } = zoneParts(zone);
	const offset = clock?.offset ?? "";
	grid.put(
		1,
		2,
		truncateLine(city, Math.max(1, width - 5 - textWidth(offset))),
		"text",
		undefined,
		true,
	);
	if (offset) putRight(grid, 1, offset, "dimText");
	const inner = Math.max(1, width - 4);
	const mapRows = Math.max(3, height - 5);
	const map = worldMap(inner, mapRows, places.get(zone) ?? null, found);
	map.forEach((line, r) =>
		line.forEach((cell, c) => {
			if (cell.kind === "sea") return;
			const intent: ColorIntent =
				cell.kind === "pin" ? "highlight" : cell.kind === "lit" ? "accent" : "dimText";
			grid.put(3 + r, 2 + c, cell.text, intent, undefined, cell.kind !== "land");
		}),
	);
	if (clock) grid.put(3 + mapRows, 2, `${clock.time} there now`, "info");
	return <CellRows grid={grid} />;
}

/** The language card: how the locale writes today's date, a time and a number. */
export function LocaleCard({
	width,
	height,
	formats,
}: {
	width: number;
	height: number;
	formats: LocaleFormats;
}): ReactNode {
	const grid = newCard(width, height);
	const region = formats.region ?? "";
	grid.put(
		1,
		2,
		truncateLine(formats.language, Math.max(1, width - 5 - textWidth(region))),
		"text",
		undefined,
		true,
	);
	if (region) putRight(grid, 1, region, "dimText");
	const step = spacing(height);
	[formats.date, formats.time, formats.number, formats.week].forEach((value, i) => {
		if (value === null) return;
		grid.put(3 + i * step, 2, truncateLine(value, width - 4), i === 3 ? "info" : "text");
	});
	return <CellRows grid={grid} />;
}

/**
 * The hostname card: the login line, a prompt and the network name with the typed name
 * in them. With no name, or a refused one, only the login line shows, in dots.
 */
export function HostnameCard({
	width,
	height,
	host,
	user,
	refused,
}: {
	width: number;
	height: number;
	host: string;
	/** The account the prompt names: the user, else root. */
	user: string | null;
	refused: boolean;
}): ReactNode {
	const grid = newCard(width, height);
	const inner = width - 4;
	const tall = height >= 12;
	const rows = tall ? [2, 5, 8, 9] : [2, 4, 6, 7];
	if (!host || refused) {
		grid.put(rows[0]!, 2, "············", "contentBorder");
		grid.put(rows[0]!, 14, " login:", "faintText");
		return <CellRows grid={grid} />;
	}
	const name = truncateLine(host, Math.max(1, inner - 12));
	const line = (row: number, parts: [string, ColorIntent, boolean?][]) => {
		let col = 2;
		for (const [text, intent, bold] of parts)
			col = grid.put(row, col, text, intent, undefined, bold);
	};
	line(rows[0]!, [
		[name, "accent", true],
		[" login:", "info"],
	]);
	line(rows[1]!, [
		[`${user ?? "root"}@`, "info"],
		[name, "accent", true],
		[user === null ? " ~ #" : " ~ $", "info"],
	]);
	line(rows[2]!, [
		[name, "accent", true],
		[".local", "info"],
	]);
	grid.put(rows[3]!, 2, "on the network", "faintText");
	return <CellRows grid={grid} />;
}

/** What each password choice means: with one, and left empty. */
export function PasswordCard({
	width,
	height,
	who,
	name,
	tool,
}: {
	width: number;
	height: number;
	who: "root" | "user";
	name: string;
	/** The admin tool of the new system (`sudo`). */
	tool: string;
}): ReactNode {
	const grid = newCard(width, height);
	const blocks: [string, string][] =
		who === "root"
			? [
					[
						"With a password",
						"You can log in as root on the console, and repair the system when nothing else works.",
					],
					["Left empty", `Root cannot log in. Only your own user administers, with ${tool}.`],
				]
			: [
					["With a password", `${name} logs in with it, and ${tool} asks for it.`],
					["Left empty", "A user needs a password to log in."],
				];
	let row = 1;
	for (const [title, text] of blocks) {
		grid.put(row, 2, truncateLine(title, width - 4), "text", undefined, true);
		const lines = wrapWords(text, width - 4);
		lines.forEach((line, i) => grid.put(row + 1 + i, 2, line, "info"));
		row += lines.length + 3;
	}
	return <CellRows grid={grid} />;
}

/** The account as it will exist: who, what they may do, and what is made for them. */
export function UserCard({
	width,
	height,
	name,
	tool,
	group,
	shell,
}: {
	width: number;
	height: number;
	name: string;
	tool: string;
	group: string;
	shell: string;
}): ReactNode {
	const grid = newCard(width, height);
	if (!name) {
		grid.put(1, 2, "No user", "text", undefined, true);
		grid.put(2, 2, truncateLine("No account is created.", width - 4), "dimText");
		return <CellRows grid={grid} />;
	}
	for (let r = 1; r <= 3; r++) grid.fill(r, 2, 7, "accent");
	grid.put(2, 5, [...name][0]!.toUpperCase(), "contentBackground", undefined, true);
	const room = Math.max(1, width - 13);
	grid.put(1, 11, truncateLine(name, room), "text", undefined, true);
	grid.put(2, 11, truncateLine("administrator", room), "info");
	grid.put(3, 11, truncateLine(`may use ${tool}`, room), "dimText");
	const step = spacing(height);
	const first = step === 2 ? 6 : 5;
	[
		["Home", `/home/${name}`],
		["Shell", shell],
		["Groups", `${name}, ${group}`],
	].forEach(([label, value], i) => {
		grid.put(first + i * step, 2, label!, "dimText");
		grid.put(first + i * step, 11, truncateLine(value!, room), "text");
	});
	return <CellRows grid={grid} />;
}

/** How a password's length reads, as a line that fills and warms with each character. */
export function StrengthLine({ length, width }: { length: number; width: number }): ReactNode {
	const grid = new CellGrid(width, 1, useSurfaceBackground());
	const fraction = Math.min(1, length / 13);
	const filled = Math.round(width * fraction);
	const intent: ColorIntent = fraction < 0.4 ? "error" : fraction < 0.7 ? "warning" : "success";
	if (filled > 0) grid.put(0, 0, "━".repeat(filled), intent, undefined, true);
	grid.put(0, filled, "━".repeat(width - filled), "panelBorder");
	return <CellRows grid={grid} />;
}

/** A raised row being typed into, as the kit's `Field`, with the character recsetup
 * refused marked (`at` is its index in the text; null marks none). */
export function MarkedField({
	label,
	text,
	width,
	at,
}: {
	label: string;
	text: string;
	width: number;
	at: number | null;
}): ReactNode {
	const grid = new CellGrid(width, 1, "raisedBackground");
	grid.put(0, 1, label, "faintText");
	const start = 1 + textWidth(label) + 2;
	let col = start;
	[...text].forEach((char, i) => {
		const marked = i === at;
		col = grid.put(
			0,
			col,
			char,
			marked ? "contentBackground" : "text",
			marked ? "error" : undefined,
			true,
		);
	});
	grid.fill(0, col, 1, "accent");
	return <CellRows grid={grid} />;
}

/** The last `width` cells of `text`. */
function tail(text: string, width: number): string {
	let out = "";
	for (const char of [...text].reverse()) {
		if (textWidth(char + out) > width) break;
		out = char + out;
	}
	return out;
}

export type SheetStep = { phase: string; command: string; state: PathState };

/**
 * The commands in the order they run, the phase named where it starts, a mark each, and
 * a long command wrapped under its own start. The running or failed one is on a raised
 * row; once anything has run, those still waiting are quieter.
 */
export function CommandSheet({
	steps,
	width,
	compact = false,
}: {
	steps: readonly SheetStep[];
	width: number;
	/** Only a failed command is wrapped; the others take one line, cut at their start so
	 * the arguments stay. */
	compact?: boolean;
}): ReactNode {
	const phaseWidth = Math.max(0, ...steps.map((step) => textWidth(step.phase)));
	const markColumn = phaseWidth + 3;
	const commandColumn = markColumn + 3;
	const room = Math.max(8, width - commandColumn);
	const lines = steps.map((step) =>
		compact && step.state !== "failed"
			? [textWidth(step.command) > room ? `…${tail(step.command, room - 1)}` : step.command]
			: wrapWords(step.command, room),
	);
	const grid = new CellGrid(
		width,
		lines.reduce((sum, own) => sum + own.length, 0),
		useSurfaceBackground(),
	);
	const started = steps.some((step) => step.state !== "waiting" && step.state !== "none");
	let row = 0;
	steps.forEach((step, i) => {
		const quiet = started && step.state === "waiting";
		const here = step.state === "running" || step.state === "failed";
		const raised: ColorIntent | undefined = here ? "raisedBackground" : undefined;
		if (here)
			for (let r = 0; r < lines[i]!.length; r++)
				grid.fill(row + r, markColumn - 1, width, "raisedBackground");
		if (i === 0 || steps[i - 1]!.phase !== step.phase)
			grid.put(row, 0, step.phase, quiet ? "faintText" : "info");
		const mark = MARKS[step.state];
		grid.put(row, markColumn, mark.mark, mark.intent, raised, here);
		lines[i]!.forEach((line, r) =>
			grid.put(row + r, commandColumn, line, quiet ? "dimText" : "text", raised, here),
		);
		row += lines[i]!.length;
	});
	return <CellRows grid={grid} />;
}

const MARKS: Record<PathState, { mark: string; intent: ColorIntent }> = {
	done: { mark: "✓", intent: "success" },
	running: { mark: "◐", intent: "warning" },
	failed: { mark: "✗", intent: "error" },
	ready: { mark: "●", intent: "accent" },
	waiting: { mark: "○", intent: "faintText" },
	none: { mark: " ", intent: "faintText" },
};
