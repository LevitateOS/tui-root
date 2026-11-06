import type {
	DocsPageMeta,
	DocsProduct,
	DocsScope,
	NavSection,
	DocsContent,
} from "@levitate/docs-content";

export type { DocsPageMeta, DocsProduct, DocsScope, NavSection };

export type DocsSource = {
	docsNav: ReadonlyArray<NavSection>;
	contentBySlug: Record<string, DocsContent>;
	metaBySlug: Record<string, DocsPageMeta>;
};

export type FlatDocsNavItem = {
	sectionTitle: string;
	title: string;
	href: string;
	slug: string;
};
