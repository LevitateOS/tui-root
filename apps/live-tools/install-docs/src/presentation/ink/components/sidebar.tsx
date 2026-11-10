import { RailList, type RailGroup, type RailItem } from "@levitate/tui-kit";
import type { ReactNode } from "react";
import type { FlatDocsNavItem } from "../../../docs";

/** How much of the docs' sections the rail lists: the current one, or every one. */
export type SidebarMode = "focus-section" | "all-sections";

type InstallSidebarProps = {
	items: ReadonlyArray<FlatDocsNavItem>;
	selectedIndex: number;
	width: number;
	rows: number;
	mode: SidebarMode;
};

/** A section that is closed shows as one row under this id, with a ▸ at its end. */
const SECTION_PREFIX = "section:";
const CLOSED_HINT = "▸";

/** The groups as the rows `lo` to `hi` (item positions across all groups) of them. */
function slice(groups: readonly RailGroup[], lo: number, hi: number): RailGroup[] {
	let at = 0;
	return groups.flatMap((group) => {
		const start = at;
		at += group.items.length;
		const kept = group.items.slice(Math.max(0, lo - start), Math.max(0, hi - start));
		if (kept.length === 0) return [];
		return [{ title: lo > start ? undefined : group.title, items: kept }];
	});
}

/** Rows a rail of these groups takes: each group's title and items, a blank row between. */
function railRows(groups: readonly RailGroup[]): number {
	return (
		groups.reduce((sum, group) => sum + group.items.length + (group.title ? 1 : 0), 0) +
		Math.max(0, groups.length - 1)
	);
}

/** The groups cut down to `rows` rows, dropping items from the end farther from `selected`. */
function fitRows(groups: readonly RailGroup[], selected: string, rows: number): RailGroup[] {
	const ids = groups.flatMap((group) => group.items.map((item) => item.id));
	const here = Math.max(0, ids.indexOf(selected));
	let lo = 0;
	let hi = ids.length;
	while (railRows(slice(groups, lo, hi)) > rows && hi - lo > 1) {
		if (here - lo > hi - 1 - here) lo += 1;
		else hi -= 1;
	}
	return slice(groups, lo, hi);
}

/**
 * The pages as a rail: the pages of the current section (or of every section), the rest
 * as one row each. Within the first section, the install guide, the pages before the
 * current one are ticked.
 */
export function InstallSidebar({
	items,
	selectedIndex,
	width,
	rows,
	mode,
}: InstallSidebarProps): ReactNode {
	const current = items[selectedIndex]!;
	const guide = items[0]!.sectionTitle;
	const sections = [...new Set(items.map((item) => item.sectionTitle))];
	const groups: RailGroup[] = sections.map((section, s) => {
		const open = mode === "all-sections" || section === current.sectionTitle;
		if (!open) {
			return {
				items: [
					{ id: `${SECTION_PREFIX}${section}`, label: section, state: "none", hint: CLOSED_HINT },
				],
			};
		}
		const pages: RailItem[] = items.flatMap((item, i) =>
			item.sectionTitle !== section
				? []
				: [
						{
							id: item.slug,
							label: item.title,
							state:
								i === selectedIndex
									? "ready"
									: section === guide && current.sectionTitle === guide && i < selectedIndex
										? "done"
										: "none",
						} satisfies RailItem,
					],
		);
		return { title: s > 0 || mode === "all-sections" ? section : undefined, items: pages };
	});
	// Closed sections stand together as one group after the open one's neighbours.
	const merged = groups.reduce<RailGroup[]>((out, group) => {
		const last = out.at(-1);
		const closed = group.items.length === 1 && group.items[0]!.hint === CLOSED_HINT;
		const lastClosed = last && last.items.every((item) => item.hint === CLOSED_HINT);
		if (closed && lastClosed) last.items = [...last.items, ...group.items];
		else out.push(group);
		return out;
	}, []);
	return (
		<RailList groups={fitRows(merged, current.slug, rows)} selected={current.slug} width={width} />
	);
}
