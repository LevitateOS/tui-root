import { Text } from "ink";
import { clampNumber, toNonNegativeInt } from "../../utils/clamp";
import { truncateLine } from "../../utils/strings";

type SectionListItem = {
	section: string;
	label: string;
};

type RenderSectionListOptions = {
	maxWidth?: number;
	emptyLabel?: string;
	marker?: string;
	inactiveMarker?: string;
	sectionPrefix?: string;
};

function marker(token: string | undefined, fallback: string): string {
	if (typeof token === "string") {
		return token.length > 0 ? token.slice(0, 1) : "";
	}
	return fallback;
}

function renderSectionList(
	items: ReadonlyArray<SectionListItem>,
	selectedIndex: number,
	options: RenderSectionListOptions = {},
): string {
	if (items.length === 0) {
		return options.emptyLabel ?? "(no items)";
	}

	const safeWidth = Math.floor(options.maxWidth ?? 30);
	const safeSelected = clampNumber(toNonNegativeInt(selectedIndex, 0), 0, items.length - 1);
	const activeMarker = marker(options.marker, ">");
	const inactiveMarker = marker(options.inactiveMarker, " ");
	const sectionPrefix = typeof options.sectionPrefix === "string" ? options.sectionPrefix : "";
	const lines: string[] = [];
	let currentSection = "";

	for (const [index, item] of items.entries()) {
		const section = item.section.trim();
		if (section !== currentSection) {
			currentSection = section;
			if (lines.length > 0) {
				lines.push("");
			}
			lines.push(
				truncateLine(
					sectionPrefix.length > 0 ? `${sectionPrefix} ${currentSection}` : currentSection,
					safeWidth,
				),
			);
		}

		const selectedMarker = index === safeSelected ? activeMarker : inactiveMarker;
		lines.push(truncateLine(`  ${selectedMarker} ${item.label}`, safeWidth));
	}

	return lines.join("\n");
}

type SectionListProps = {
	items: ReadonlyArray<SectionListItem>;
	selectedIndex: number;
	maxWidth?: number;
	emptyLabel?: string;
	marker?: string;
	inactiveMarker?: string;
	sectionPrefix?: string;
};

export function SectionList({
	items,
	selectedIndex,
	maxWidth,
	emptyLabel,
	marker,
	inactiveMarker,
	sectionPrefix,
}: SectionListProps) {
	return (
		<Text>
			{renderSectionList(items, selectedIndex, {
				maxWidth,
				emptyLabel,
				marker,
				inactiveMarker,
				sectionPrefix,
			})}
		</Text>
	);
}
