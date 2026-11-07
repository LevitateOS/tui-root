/**
 * Scrolling a page taller than its pane. The page is measured after each render; the
 * footer needs to know whether it scrolls before the pane's final height is known, so
 * measuring (`usePageHeight`) and scrolling (`usePageScroll`) are two hooks.
 */
import { measureElement, type DOMElement } from "ink";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useKeymap, type Keymap } from "../../runtime/keymap";

/** Scrolls a page by about a pane, from either pane. */
export const PAGE_SCROLL_KEYS = [
	{
		action: "scroll",
		keys: ["C-u", "pageup", "space", "C-d", "pagedown"],
		hint: "space/PgUp",
		label: "scroll page",
	},
] as const satisfies Keymap;

const SCROLL_UP = new Set(["C-u", "pageup"]);

export type PageHeight = {
	/** Put on the page's outermost box. */
	ref: RefObject<DOMElement | null>;
	/** The page's rendered height in rows (0 before the first measure). */
	height: number;
	/** The page shown, so a new page starts at its top. */
	page: unknown;
};

/** The rendered height of the page, re-measured after every render. */
export function usePageHeight(page: unknown): PageHeight {
	const ref = useRef<DOMElement>(null);
	const [height, setHeight] = useState(0);
	useEffect(() => {
		if (ref.current) {
			const measured = measureElement(ref.current).height;
			if (measured !== height) setHeight(measured);
		}
	});
	return { ref, height, page };
}

/** Scrolls `page` within `rows`: the offset to draw it at (a negative top margin), and
 * arrows for the pane title when there is more above or below. */
export function usePageScroll(
	page: PageHeight,
	rows: number,
	active: boolean,
): { offset: number; more: string } {
	const [offset, setOffset] = useState(0);
	useEffect(() => setOffset(0), [page.page]);
	const maxOffset = Math.max(0, page.height - rows);
	const shown = Math.min(offset, maxOffset);
	useKeymap(
		PAGE_SCROLL_KEYS,
		{
			scroll: (key) =>
				setOffset((value) =>
					Math.max(
						0,
						Math.min(maxOffset, value + (SCROLL_UP.has(key) ? -1 : 1) * Math.max(1, rows - 2)),
					),
				),
		},
		{ active: active && maxOffset > 0 },
	);
	return { offset: shown, more: `${shown > 0 ? " ↑" : ""}${shown < maxOffset ? " ↓" : ""}` };
}
