import { useListNavigation } from "@levitate/tui-kit";
import type { Docs } from "../../../docs";

/** Which of the docs' pages is shown, moved by page or by section. */
export function useInstallNavigation(docs: Docs, initialIndex: number) {
	const index = useListNavigation(docs.pages.length, initialIndex);
	return {
		safeIndex: index.safeIndex,
		movePage: (delta: number) => index.moveBy(delta),
		moveSection: (delta: number) => index.setIndex(docs.sectionStart(index.safeIndex, delta)),
		setPage: (page: number) => index.setIndex(page),
	};
}
