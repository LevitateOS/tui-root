import { contentBySlug, docsNav, type DocsContent } from "@levitate/docs-content";

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

/** Every page docs-content has, in nav order, once each. */
export const PAGES: readonly FlatDocsNavItem[] = (() => {
	const seen = new Set<string>();
	const pages: FlatDocsNavItem[] = [];
	for (const section of docsNav) {
		for (const item of section.items) {
			const slug = docsSlugFromHref(item.href);
			if (contentBySlug[slug] === undefined || seen.has(slug)) continue;
			seen.add(slug);
			pages.push({ sectionTitle: section.title, title: item.title, slug });
		}
	}
	return pages;
})();

export function pageContent(slug: string): DocsContent {
	return contentBySlug[slug]!;
}

export type LinkTarget = { ok: true; slug: string; index: number } | { ok: false; reason: string };

/** The page a docs link opens; `#anchor` links stay on `currentSlug`. */
export function resolveDocsLinkTarget(href: string, currentSlug: string): LinkTarget {
	const trimmed = href.trim();
	if (trimmed.length === 0) return { ok: false, reason: "empty href" };
	const slug = trimmed.startsWith("#") ? currentSlug : docsSlugFromHref(trimmed);
	const index = PAGES.findIndex((page) => page.slug === slug);
	return index < 0
		? { ok: false, reason: `slug '${slug}' not in docs navigation` }
		: { ok: true, slug, index };
}

/** The first page of the section `delta` sections away from page `index`. */
export function sectionStart(index: number, delta: number): number {
	const starts = PAGES.flatMap((page, i) =>
		i === 0 || PAGES[i - 1]!.sectionTitle !== page.sectionTitle ? [i] : [],
	);
	const current = starts.filter((start) => start <= index).length - 1;
	return starts[Math.max(0, Math.min(starts.length - 1, current + delta))] ?? 0;
}
