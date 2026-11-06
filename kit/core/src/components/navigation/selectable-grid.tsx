import { Box } from "ink";
import type { ReactNode } from "react";
import { clampIndex } from "../../utils/clamp";

export type GridItemContext = {
	index: number;
	selected: boolean;
};

type SelectableGridProps<T> = {
	items: ReadonlyArray<T>;
	selectedIndex: number;
	columns: number;
	/** Columns available to the whole grid; each cell gets an equal share after the gaps. */
	width: number;
	gapX?: number;
	gapY?: number;
	renderItem: (item: T, context: GridItemContext) => ReactNode;
};

/** Items in rows of `columns` equal cells, one of them selected. */
export function SelectableGrid<T>({
	items,
	selectedIndex,
	columns,
	width,
	gapX = 1,
	gapY = 0,
	renderItem,
}: SelectableGridProps<T>) {
	const perRow = Math.max(1, Math.floor(columns));
	const cellWidth = Math.max(1, Math.floor((width - gapX * (perRow - 1)) / perRow));
	const selected = clampIndex(selectedIndex, items.length);
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
	return (
		<Box flexDirection="column">
			{rows.map((row, r) => (
				<Box key={`row-${r}`} flexDirection="row" marginBottom={r < rows.length - 1 ? gapY : 0}>
					{row.map((item, c) => {
						const index = r * perRow + c;
						return (
							<Box key={`cell-${index}`} width={cellWidth} marginRight={c < perRow - 1 ? gapX : 0}>
								{renderItem(item, { index, selected: index === selected })}
							</Box>
						);
					})}
				</Box>
			))}
		</Box>
	);
}
