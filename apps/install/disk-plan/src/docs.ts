import { sharedPages, type SharedSlug } from "@levitate/docs-content";
import { guideRef, guideTitle } from "@levitate/docs-content/install";

/** A place in the docs: page and section titles as the docs have them, and the slug that opens it. */
export type DocsRef = { slug: string; page: string; section?: string };

/** A section of a shared docs page, checked at startup, so a renamed one fails loudly
 * instead of leaving a dead reference on screen. Install guide steps are typed by the
 * procedure instead, and every distro has them under the same slug and title. */
function shared(slug: SharedSlug, section?: string): DocsRef {
	const content = sharedPages[slug];
	if (section !== undefined && !content.sections.some((s) => s.title === section)) {
		throw new Error(
			`disk-plan refers to section '${section}' of docs page '${slug}', which it doesn't have`,
		);
	}
	return { slug, page: content.title, section };
}

const chooseDisk = guideRef("installation-disk", "Identify Target Disk");

/** Where to read about what went wrong. */
export const DOCS = {
	/** Choosing the disk: what to check when recpart refuses one. */
	chooseDisk: { ...chooseDisk, page: guideTitle(chooseDisk.slug) },
	/** What recpart's error codes mean. */
	recpartErrors: shared("recpart", "Error Codes"),
	recpart: shared("recpart"),
} as const;
