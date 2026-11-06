import { useCallback, useMemo, useState } from "react";

export type FocusPlane = "navigation" | "content";

type FocusPlaneOptions = {
	initial?: FocusPlane;
};

type FocusPlaneState = {
	plane: FocusPlane;
	isNavigation: boolean;
	isContent: boolean;
	setPlane: (next: FocusPlane) => void;
	togglePlane: () => void;
};

function toggleFocusPlane(plane: FocusPlane): FocusPlane {
	return plane === "navigation" ? "content" : "navigation";
}

export function useFocusPlane(options: FocusPlaneOptions = {}): FocusPlaneState {
	const initial = options.initial ?? "content";
	const [plane, setPlane] = useState<FocusPlane>(initial);

	const togglePlane = useCallback(() => {
		setPlane((current) => toggleFocusPlane(current));
	}, []);

	return useMemo(
		() => ({
			plane,
			isNavigation: plane === "navigation",
			isContent: plane === "content",
			setPlane,
			togglePlane,
		}),
		[plane, togglePlane],
	);
}
