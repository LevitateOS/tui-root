/** Something being typed: a raised row with its label, the text and a cursor. */
import type { ReactNode } from "react";
import { CellGrid, CellRows } from "../../primitives/display/cells";
import { textWidth } from "../../utils/strings";

/**
 * A raised row `width` cells wide: the label, the text (dots when `secret`), the cursor
 * as a cell in the accent (unless `cursor` is false), and `trailing` (a count, a unit)
 * at its end when there is room. Text too long for the row shows its end.
 */
export function Field({
	label,
	text,
	width,
	trailing,
	secret = false,
	cursor = true,
}: {
	label: string;
	text: string;
	width: number;
	trailing?: string;
	secret?: boolean;
	cursor?: boolean;
}): ReactNode {
	const grid = new CellGrid(width, 1, "raisedBackground");
	const shown = secret ? "•".repeat([...text].length) : text;
	const start = 1 + textWidth(label) + 2;
	const fixed = start + (cursor ? 1 : 0) + 1;
	const end =
		trailing && fixed + textWidth(shown) + textWidth(trailing) + 2 <= width ? trailing : "";
	const room = Math.max(0, width - fixed - (end ? textWidth(end) + 1 : 0));
	let visible = shown;
	while (textWidth(visible) > room) visible = [...visible].slice(1).join("");
	grid.put(0, 1, label, "faintText");
	const after = grid.put(0, start, visible, "text", undefined, true);
	if (cursor) grid.fill(0, after, 1, "accent");
	if (end) grid.put(0, width - 1 - textWidth(end), end, "faintText");
	return <CellRows grid={grid} />;
}
