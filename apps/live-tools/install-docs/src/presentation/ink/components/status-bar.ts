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
};

/** The footer: every key that works in the focused pane, and the page's place at the line's end. */
export function installStatusSegments({
	page,
	pageCount,
	focus,
	action,
}: InstallStatus): StatusSegment[] {
	const segments: StatusSegment[] = [
		...(focus === "content"
			? [textStatusSegment("action", action ?? "no actions", action ? "accent" : "dimText")]
			: []),
		...keymapStatusSegments(VIEWER_KEYS),
		...keymapStatusSegments(focus === "navigation" ? NAV_KEYS : CONTENT_KEYS),
		textStatusSegment("page", `page ${page} of ${pageCount}`, "faintText", false, true),
	];
	return segments;
}
