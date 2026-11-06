import { useState } from "react";
import { clampNumber } from "../utils/clamp";

type ScrollState = {
	/** The first visible line, always within 0..maxScroll. */
	offset: number;
	scrollBy: (delta: number) => void;
	scrollTo: (offset: number) => void;
	toTop: () => void;
	toBottom: () => void;
};

/** A scroll position that can never pass `maxScroll` (content lines minus visible rows). */
export function useScrollState(maxScroll: number): ScrollState {
	const max = Math.max(0, Math.floor(maxScroll));
	const [raw, setRaw] = useState(0);
	const offset = Math.min(raw, max);
	const scrollTo = (next: number) => setRaw(clampNumber(Math.floor(next), 0, max));
	return {
		offset,
		scrollBy: (delta) => scrollTo(offset + delta),
		scrollTo,
		toTop: () => setRaw(0),
		toBottom: () => setRaw(max),
	};
}
