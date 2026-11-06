import { TreeNav, type TreeNavMode } from "@levitate/tui-kit";
import type { ReactNode } from "react";
import type { FlatDocsNavItem } from "../../../domain/content/contracts";

type InstallSidebarProps = {
	items: ReadonlyArray<FlatDocsNavItem>;
	selectedIndex: number;
	maxWidth: number;
	currentSection?: string;
	mode?: TreeNavMode;
};

export function InstallSidebar({
	items,
	selectedIndex,
	maxWidth,
	currentSection,
	mode = "focus-section",
}: InstallSidebarProps): ReactNode {
	return (
		<TreeNav
			items={items.map((item) => ({
				key: item.slug,
				section: item.sectionTitle,
				label: item.title,
			}))}
			selectedIndex={selectedIndex}
			maxWidth={maxWidth}
			currentSection={currentSection}
			mode={mode}
			inactiveItemMarker=" "
			sectionIntent="heading"
		/>
	);
}
