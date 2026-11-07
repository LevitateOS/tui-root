#!/usr/bin/env bun
import manifest from "../package.json";
import { runApp, UsageError } from "@levitate/tui-kit";
import { PAGES } from "./docs";
import { CONTENT_KEYS, NAV_KEYS, VIEWER_KEYS } from "./presentation/ink/keymap";
import { InstallViewerScreen } from "./presentation/ink/screens/install-viewer";
import { createInstallDocsTheme } from "./presentation/ink/theme/index";

runApp({
	name: "install-docs",
	summary: manifest.description,
	flags: [
		{ name: "slug", alias: "s", value: "SLUG", help: "open this page (default: the first page)" },
		{ name: "title", value: "TITLE", help: 'title of the page list (default: "Docs")' },
		{ name: "pages", help: "print every page slug, one per line, and exit" },
	],
	keys: [
		{ title: "Keys (either pane)", keymap: VIEWER_KEYS },
		{ title: "Keys (page list focused)", keymap: NAV_KEYS },
		{ title: "Keys (content focused)", keymap: CONTENT_KEYS },
	],
	theme: createInstallDocsTheme(),
	run: (args) => {
		if (args.pages) {
			console.log(PAGES.map((page) => page.slug).join("\n"));
			return undefined;
		}
		const slug = typeof args.slug === "string" ? args.slug.trim() : undefined;
		const index = slug === undefined ? 0 : PAGES.findIndex((page) => page.slug === slug);
		if (index < 0) {
			throw new UsageError(`no page '${slug}' (--pages lists them)`);
		}
		const title = typeof args.title === "string" ? args.title : "Docs";
		return <InstallViewerScreen title={title} initialIndex={index} />;
	},
});
