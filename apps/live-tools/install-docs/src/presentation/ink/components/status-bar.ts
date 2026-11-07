import {
	keymapStatusSegments,
	textStatusSegment,
	type FocusPlane,
	type StatusSegment,
} from "@levitate/tui-kit";
import { CONTENT_KEYS, NAV_KEYS, VIEWER_KEYS } from "../keymap";

type InstallStatus = {
	page: number;
	pageCount: number;
	focus: FocusPlane;
	/** Position of the selected action, e.g. "2/5", when there are actions. */
	action?: string;
	note?: string;
};

/** The footer: where you are, then every key that works in the focused pane. */
export function installStatusSegments({
	page,
	pageCount,
	focus,
	action,
	note,
}: InstallStatus): StatusSegment[] {
	const segments: StatusSegment[] = [
		textStatusSegment("focus", focus, focus === "navigation" ? "warning" : "accent"),
		textStatusSegment("page", `page ${page}/${pageCount}`),
		...(focus === "content"
			? [textStatusSegment("action", action ?? "no actions", action ? "accent" : "dimText")]
			: []),
		...keymapStatusSegments(VIEWER_KEYS),
		...keymapStatusSegments(focus === "navigation" ? NAV_KEYS : CONTENT_KEYS),
	];
	if (note && note.trim().length > 0) {
		segments.push(textStatusSegment("note", note.trim(), "warning"));
	}
	return segments;
}
