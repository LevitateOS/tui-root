#!/usr/bin/env bun
import { runApp } from "@levitate/tui-kit";
import { installDocsScreen, listPageSlugs } from "./app/bootstrap";
import { CONTENT_KEYS, NAV_KEYS, VIEWER_KEYS } from "./presentation/ink/keymap";
import { createInstallDocsTheme } from "./presentation/ink/theme/index";

runApp({
	name: "install-docs",
	summary: "the LevitateOS docs, for reading beside the install shell",
	flags: [
		{ name: "slug", alias: "s", value: "SLUG", help: "open this page (default: installation)" },
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
			console.log(listPageSlugs().join("\n"));
			return undefined;
		}
		return installDocsScreen({ slug: typeof args.slug === "string" ? args.slug : undefined });
	},
});
