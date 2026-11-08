import { docsFor, docsNav, type DocsContent } from "@levitate/docs-content";
import type { Distro } from "@levitate/docs-content/distros";

/** One page of the docs nav. */
export type FlatDocsNavItem = {
	sectionTitle: string;
	title: string;
	slug: string;
};

/** `/docs/<slug>` (or `docs/<slug>`, `/<slug>`), without query, fragment or trailing slash. */
export function docsSlugFromHref(href: string): string {
	const path = href.trim().split(/[?#]/)[0]!.replace(/\/+$/, "");
	return path.replace(/^\/?docs\//, "").replace(/^\//, "");
}

export type LinkTarget = { ok: true; slug: string; index: number } | { ok: false; reason: string };

/** One distro's docs: its pages in nav order, and how links between them resolve. */
export interface Docs {
	pages: readonly FlatDocsNavItem[];
	content(slug: string): DocsContent;
	/** The index of the page `slug` names, or -1. */
	pageIndex(slug: string): number;
	/** The page a docs link opens; `#anchor` links stay on `currentSlug`. */
	resolveLink(href: string, currentSlug: string): LinkTarget;
	/** The first page of the section `delta` sections away from page `index`. */
	sectionStart(index: number, delta: number): number;
}

/** The docs as `distro` has them: every page shared by all distros, and its own distro pages. */
export function distroDocs(distro: Distro): Docs {
	const content = docsFor(distro.id) as Record<string, DocsContent>;
	const pages = docsNav.flatMap((section) =>
		section.items.map((item) => ({
			sectionTitle: section.title,
			title: item.title,
			slug: item.slug,
		})),
	);
	const pageIndex = (slug: string) => pages.findIndex((page) => page.slug === slug);
	const starts = pages.flatMap((page, i) =>
		i === 0 || pages[i - 1]!.sectionTitle !== page.sectionTitle ? [i] : [],
	);
	return {
		pages,
		content: (slug) => content[slug]!,
		pageIndex,
		resolveLink: (href, currentSlug) => {
			const trimmed = href.trim();
			if (trimmed.length === 0) return { ok: false, reason: "empty href" };
			const slug = trimmed.startsWith("#") ? currentSlug : docsSlugFromHref(trimmed);
			const index = pageIndex(slug);
			return index < 0
				? { ok: false, reason: `slug '${slug}' not in docs navigation` }
				: { ok: true, slug, index };
		},
		sectionStart: (index, delta) => {
			const current = starts.filter((start) => start <= index).length - 1;
			return starts[Math.max(0, Math.min(starts.length - 1, current + delta))] ?? 0;
		},
	};
}
