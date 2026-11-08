import { Box, Text } from "ink";
import { useIntentColor } from "../../app/app-provider";
import type { ColorIntent } from "../../theme/tokens";
import { clampIndex } from "../../utils/clamp";
import { padRight, truncateLine } from "../../utils/strings";

/** Show every section's items, or only the selected item's section (others collapsed). */
export type NavListMode = "focus-section" | "all-sections";

export type NavListItem = {
	key: string;
	section: string;
	label: string;
};

type NavListProps = {
	items: ReadonlyArray<NavListItem>;
	selectedIndex: number;
	/** Columns to fill: every row is padded or cut to this. */
	width: number;
	mode?: NavListMode;
	emptyLabel?: string;
	markers?: Partial<typeof DEFAULT_MARKERS>;
	sectionIntent?: ColorIntent;
};

const DEFAULT_MARKERS = { expanded: "▾", collapsed: "▸", active: "▸", inactive: "•" };

type Row = { key: string; text: string; kind: "section" | "collapsed" | "item" | "active" | "gap" };

function rows(
	items: ReadonlyArray<NavListItem>,
	selected: number,
	mode: NavListMode,
	markers: typeof DEFAULT_MARKERS,
	emptyLabel: string,
	width: number,
): Row[] {
	const line = (text: string) => padRight(truncateLine(text, width), width);
	if (items.length === 0) return [{ key: "empty", text: line(emptyLabel), kind: "item" }];
	const activeSection = items[selected]!.section;
	const out: Row[] = [];
	let section: string | undefined;
	items.forEach((item, index) => {
		if (item.section !== section) {
			section = item.section;
			if (out.length > 0) out.push({ key: `gap-${index}`, text: line(""), kind: "gap" });
			const collapsed = mode === "focus-section" && section !== activeSection;
			const marker = collapsed ? markers.collapsed : markers.expanded;
			out.push({
				key: `section-${index}`,
				text: line(`${marker} ${section}`),
				kind: collapsed ? "collapsed" : "section",
			});
		}
		if (mode === "focus-section" && item.section !== activeSection) return;
		const active = index === selected;
		out.push({
			key: item.key,
			text: line(` ${active ? markers.active : markers.inactive} ${item.label}`),
			kind: active ? "active" : "item",
		});
	});
	return out;
}

/** A list of items grouped under section headings, with one item selected. */
export function NavList({
	items,
	selectedIndex,
	width,
	mode = "all-sections",
	emptyLabel = "(empty)",
	markers,
	sectionIntent = "navHeading",
}: NavListProps) {
	const color = useIntentColor();
	const style: Record<Row["kind"], { color?: string; background?: string; bold?: boolean }> = {
		section: { color: color(sectionIntent), bold: true },
		collapsed: { color: color("dimText") },
		item: { color: color("navItem") },
		gap: {},
		active: { color: color("selection"), background: color("selectionBackground"), bold: true },
	};
	const all = rows(
		items,
		clampIndex(selectedIndex, items.length),
		mode,
		{ ...DEFAULT_MARKERS, ...markers },
		emptyLabel,
		Math.max(1, Math.floor(width)),
	);
	return (
		<Box flexDirection="column">
			{all.map((row) => (
				<Text
					key={row.key}
					color={style[row.kind].color}
					backgroundColor={style[row.kind].background}
					bold={style[row.kind].bold}
				>
					{row.text}
				</Text>
			))}
		</Box>
	);
}
