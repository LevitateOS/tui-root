import { runsText, wrapRuns, type RichTextRun } from "../../utils/runs";
import { textWidth } from "../../utils/strings";
import { keyHint, type Keymap } from "../../runtime/keymap";

import type { ColorIntent } from "../../theme/tokens";

export type StatusSegment = {
	id: string;
	atoms: ReadonlyArray<RichTextRun>;
};

const SEPARATOR = " | ";

/**
 * The segments as lines at most `width` cells wide: segments joined by a separator, a new
 * line where the next one doesn't fit, a segment never split unless it alone is too wide.
 */
export function statusLines(
	segments: ReadonlyArray<StatusSegment>,
	width: number,
): RichTextRun[][] {
	const safe = Math.max(1, Math.floor(width));
	const lines: RichTextRun[][] = [];
	let line: RichTextRun[] = [];
	let used = 0;
	for (const segment of segments) {
		const atoms = segment.atoms.filter((atom) => atom.text.length > 0);
		if (atoms.length === 0) continue;
		const size = textWidth(runsText(atoms));
		if (line.length > 0 && used + SEPARATOR.length + size <= safe) {
			line.push({ text: SEPARATOR, intent: "dimText" }, ...atoms);
			used += SEPARATOR.length + size;
			continue;
		}
		if (line.length > 0) lines.push(line);
		if (size <= safe) {
			line = [...atoms];
			used = size;
		} else {
			const wrapped = wrapRuns(atoms, safe);
			lines.push(...wrapped.slice(0, -1));
			line = wrapped.at(-1) ?? [];
			used = textWidth(runsText(line));
		}
	}
	if (line.length > 0) lines.push(line);
	return lines;
}

export function hotkeyStatusSegment(
	id: string,
	key: string,
	label: string,
	keyIntent: ColorIntent = "accent",
	labelIntent: ColorIntent = "dimText",
): StatusSegment {
	const normalizedKey = key.trim();
	const normalizedLabel = label.trim();

	return {
		id,
		atoms: [
			{
				text: normalizedKey.length > 0 ? normalizedKey : "?",
				intent: keyIntent,
				bold: true,
			},
			{
				text: normalizedLabel.length > 0 ? ` ${normalizedLabel}` : "",
				intent: labelIntent,
			},
		],
	};
}

export function textStatusSegment(
	id: string,
	text: string,
	intent: ColorIntent = "dimText",
	bold = false,
): StatusSegment {
	return {
		id,
		atoms: [
			{
				text,
				intent,
				bold,
			},
		],
	};
}

/** Footer segments for a keymap: each binding's keys and label. */
export function keymapStatusSegments(keymap: Keymap): StatusSegment[] {
	return keymap.map((binding) =>
		hotkeyStatusSegment(binding.action, keyHint(binding), binding.label),
	);
}
