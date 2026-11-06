import {
	SegmentedStatusLine,
	keymapStatusSegments,
	scopeStatusSegment,
	textStatusSegment,
	type FocusPlane,
	type StatusSegment,
	useAppName,
} from "@levitate/tui-kit";
import type { ReactNode } from "react";
import { CONTENT_KEYS, NAV_KEYS, VIEWER_KEYS } from "../keymap";

type InstallStatusBarProps = {
	page: number;
	pageCount: number;
	focus: FocusPlane;
	/** Position of the selected action, e.g. "2/5", when there are actions. */
	action?: string;
	note?: string;
};

export function InstallStatusBar({
	page,
	pageCount,
	focus,
	action,
	note,
}: InstallStatusBarProps): ReactNode {
	const segments: StatusSegment[] = [
		scopeStatusSegment(useAppName()),
		textStatusSegment("focus", focus, focus === "navigation" ? "warning" : "accent"),
		textStatusSegment("page", `page ${page}/${pageCount}`),
		...(focus === "content"
			? [textStatusSegment("action", action ?? "no actions", action ? "accent" : "dimText")]
			: []),
		...keymapStatusSegments(focus === "navigation" ? NAV_KEYS : CONTENT_KEYS),
		...keymapStatusSegments(VIEWER_KEYS),
	];
	if (note && note.trim().length > 0) {
		segments.push(textStatusSegment("note", note.trim(), "warning"));
	}
	return <SegmentedStatusLine segments={segments} />;
}
