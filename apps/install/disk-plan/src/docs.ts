import { contentBySlug } from "@levitate/docs-content";

/** A place in the docs: page and section titles as the docs have them, and the slug that opens it. */
export type DocsRef = { slug: string; page: string; section?: string };

/** Looks the page (and section) up in the docs, so a renamed one fails loudly here
 * instead of leaving a dead reference on screen. */
function docs(slug: string, section?: string): DocsRef {
	const content = contentBySlug[slug];
	if (!content)
		throw new Error(`disk-plan refers to docs page '${slug}', which the docs don't have`);
	if (section !== undefined && !content.sections.some((s) => s.title === section)) {
		throw new Error(
			`disk-plan refers to section '${section}' of docs page '${slug}', which it doesn't have`,
		);
	}
	return { slug, page: content.title, section };
}

/** Where to read about what went wrong. */
export const DOCS = {
	/** Choosing the disk: what to check when recpart refuses one. */
	chooseDisk: docs("installation-disk", "2. Identify Target Disk"),
	/** What recpart's error codes mean. */
	recpartErrors: docs("recpart", "Error Codes"),
	recpart: docs("recpart"),
} as const;
