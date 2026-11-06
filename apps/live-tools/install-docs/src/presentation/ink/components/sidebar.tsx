import { NavList, type NavListMode } from "@levitate/tui-kit";
import type { ReactNode } from "react";
import type { FlatDocsNavItem } from "../../../docs";

type InstallSidebarProps = {
	items: ReadonlyArray<FlatDocsNavItem>;
	selectedIndex: number;
	maxWidth: number;
	mode?: NavListMode;
};

export function InstallSidebar({
	items,
	selectedIndex,
	maxWidth,
	mode = "focus-section",
}: InstallSidebarProps): ReactNode {
	return (
		<NavList
			items={items.map((item) => ({
				key: item.slug,
				section: item.sectionTitle,
				label: item.title,
			}))}
			selectedIndex={selectedIndex}
			width={maxWidth}
			mode={mode}
			markers={{ inactive: " " }}
			sectionIntent="heading"
		/>
	);
}
