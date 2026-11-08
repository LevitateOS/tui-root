import { readFileSync } from "node:fs";
import { contentBySlug, docsNav, metaBySlug, type DocsContent } from "@levitate/docs-content";
import {
	DISTROS,
	distroByOsId,
	osReleaseValue,
	type DistroId,
} from "@levitate/docs-content/distros";

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

/** The distro whose install pages the docs show, by variant id; docs-content's `shared` pages go with every one. */
export type DocsProduct = DistroId;
export const PRODUCTS: readonly DocsProduct[] = DISTROS.map((distro) => distro.id);

/** The running system's distro, from `ID` in /etc/os-release; LevitateOS when it is none of the variants. */
export function detectProduct(osRelease = "/etc/os-release"): DocsProduct {
	let text = "";
	try {
		text = readFileSync(osRelease, "utf8");
	} catch {
		return "levitate";
	}
	return distroByOsId(osReleaseValue(text, "ID")?.toLowerCase() ?? "")?.id ?? "levitate";
}

let product: DocsProduct = detectProduct();

/** Every page docs-content has for `product`, in nav order, once each. */
function pagesFor(product: DocsProduct): FlatDocsNavItem[] {
	const seen = new Set<string>();
	const pages: FlatDocsNavItem[] = [];
	for (const section of docsNav) {
		for (const item of section.items) {
			const slug = docsSlugFromHref(item.href);
			if (contentBySlug[slug] === undefined || seen.has(slug)) continue;
			const owner = metaBySlug[slug]?.product ?? "shared";
			if (owner !== "shared" && owner !== product) continue;
			seen.add(slug);
			pages.push({ sectionTitle: section.title, title: item.title, slug });
		}
	}
	return pages;
}

/** The pages shown, for the product `selectProduct` chose (the running system's by default). */
export const PAGES: FlatDocsNavItem[] = pagesFor(product);

/** Shows `next`'s pages from now on. */
export function selectProduct(next: DocsProduct): void {
	product = next;
	PAGES.splice(0, PAGES.length, ...pagesFor(next));
}

/**
 * The index of the page `slug` names. A page of the other distro opens this one's
 * counterpart, named with the distro prefix (`installation-disk` on AcornOS opens
 * `acorn-installation-disk`), so shared pages and other apps can link either way.
 */
export function pageIndex(slug: string): number {
	const exact = PAGES.findIndex((page) => page.slug === slug);
	if (exact >= 0) return exact;
	const bare = slug.replace(/^acorn-/, "");
	const counterpart = product === "levitate" ? bare : `${product}-${bare}`;
	return PAGES.findIndex((page) => page.slug === counterpart);
}

export function pageContent(slug: string): DocsContent {
	return contentBySlug[slug]!;
}

export type LinkTarget = { ok: true; slug: string; index: number } | { ok: false; reason: string };

/** The page a docs link opens; `#anchor` links stay on `currentSlug`. */
export function resolveDocsLinkTarget(href: string, currentSlug: string): LinkTarget {
	const trimmed = href.trim();
	if (trimmed.length === 0) return { ok: false, reason: "empty href" };
	const slug = trimmed.startsWith("#") ? currentSlug : docsSlugFromHref(trimmed);
	const index = pageIndex(slug);
	return index < 0
		? { ok: false, reason: `slug '${slug}' not in docs navigation` }
		: { ok: true, slug: PAGES[index]!.slug, index };
}

/** The first page of the section `delta` sections away from page `index`. */
export function sectionStart(index: number, delta: number): number {
	const starts = PAGES.flatMap((page, i) =>
		i === 0 || PAGES[i - 1]!.sectionTitle !== page.sectionTitle ? [i] : [],
	);
	const current = starts.filter((start) => start <= index).length - 1;
	return starts[Math.max(0, Math.min(starts.length - 1, current + delta))] ?? 0;
}
