import { useListNavigation } from "@levitate/tui-kit";
import { PAGES, sectionStart } from "../../../docs";

/** Which page of `PAGES` is shown, moved by page or by section. */
export function useInstallNavigation(initialIndex: number) {
	const index = useListNavigation(PAGES.length, initialIndex);
	return {
		safeIndex: index.safeIndex,
		movePage: (delta: number) => index.moveBy(delta),
		moveSection: (delta: number) => index.setIndex(sectionStart(index.safeIndex, delta)),
		setPage: (page: number) => index.setIndex(page),
	};
}
