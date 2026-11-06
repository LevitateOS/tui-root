import { useCallback, useEffect, useMemo, useState } from "react";
import { clampIndex, toPositiveInt } from "../utils/clamp";

type GridDirection = "left" | "right" | "up" | "down";

type GridNavigationOptions = {
	count: number;
	columns: number;
	initialIndex?: number;
};

type GridNavigationState = {
	safeIndex: number;
	setIndex: (index: number) => void;
	move: (direction: GridDirection) => void;
};

function transitionGridIndex(
	currentIndex: number,
	count: number,
	columns: number,
	direction: GridDirection,
): number {
	const safeTotal = Math.max(0, Math.floor(count));
	if (safeTotal <= 0) {
		return 0;
	}
	const safeColumns = toPositiveInt(columns, 1);
	const safeCurrent = clampIndex(currentIndex, safeTotal);
	const lastIndex = safeTotal - 1;
	const rowStart = Math.floor(safeCurrent / safeColumns) * safeColumns;
	const rowEnd = Math.min(rowStart + safeColumns - 1, lastIndex);

	if (direction === "left") {
		return Math.max(safeCurrent - 1, rowStart);
	}
	if (direction === "right") {
		return Math.min(safeCurrent + 1, rowEnd);
	}
	if (direction === "up") {
		return Math.max(safeCurrent - safeColumns, 0);
	}
	return Math.min(safeCurrent + safeColumns, lastIndex);
}

export function useGridNavigation({
	count,
	columns,
	initialIndex = 0,
}: GridNavigationOptions): GridNavigationState {
	const safeTotal = Math.max(0, Math.floor(count));
	const safeColumns = toPositiveInt(columns, 1);
	const [currentIndex, setCurrentIndex] = useState(() => clampIndex(initialIndex, safeTotal));

	useEffect(() => {
		setCurrentIndex((value) => clampIndex(value, safeTotal));
	}, [safeTotal]);

	const safeIndex = clampIndex(currentIndex, safeTotal);
	const setIndex = useCallback(
		(index: number) => setCurrentIndex(clampIndex(index, safeTotal)),
		[safeTotal],
	);
	const move = useCallback(
		(direction: GridDirection) =>
			setCurrentIndex((value) => transitionGridIndex(value, safeTotal, safeColumns, direction)),
		[safeColumns, safeTotal],
	);
	return useMemo(() => ({ safeIndex, setIndex, move }), [move, safeIndex, setIndex]);
}
