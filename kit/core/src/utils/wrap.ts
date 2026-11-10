import { textWidth, truncateLine } from "./strings";

/** Plain text broken at spaces into lines at most `width` cells wide; a word longer than
 * a line is cut. */
export function wrapText(text: string, width: number): string[] {
	const safe = Math.max(1, Math.floor(width));
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(" ")) {
		if (line && textWidth(line) + 1 + textWidth(word) > safe) {
			lines.push(line);
			line = word;
		} else {
			line = line ? `${line} ${word}` : word;
		}
	}
	if (line) lines.push(line);
	return lines.map((part) => truncateLine(part, safe));
}
