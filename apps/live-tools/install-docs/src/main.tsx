#!/usr/bin/env bun
import manifest from "../package.json";
import { runApp, UsageError } from "@levitate/tui-kit";
import { DISTROS } from "@levitate/docs-content/distros";
import { distroDocs } from "./docs";
import { CONTENT_KEYS, NAV_KEYS, VIEWER_KEYS } from "./presentation/ink/keymap";
import { InstallViewerScreen } from "./presentation/ink/screens/install-viewer";
import { createInstallDocsTheme } from "./presentation/ink/theme/index";

runApp({
	name: "install-docs",
	summary: manifest.description,
	flags: [
		{ name: "slug", alias: "s", value: "SLUG", help: "open this page (default: the first page)" },
		{
			name: "os-name",
			value: "NAME",
			choices: DISTROS.map((d) => d.osName),
			help: "the distro whose docs to show, as the install screen's launcher names it",
		},
		{ name: "pages", help: "print every page slug, one per line, and exit" },
	],
	keys: [
		{ title: "Keys (either pane)", keymap: VIEWER_KEYS },
		{ title: "Keys (page list focused)", keymap: NAV_KEYS },
		{ title: "Keys (content focused)", keymap: CONTENT_KEYS },
	],
	theme: createInstallDocsTheme(),
	run: (args) => {
		const distro = DISTROS.find((d) => d.osName === args["os-name"]);
		if (!distro) throw new UsageError("--os-name names the distro whose docs to show");
		const docs = distroDocs(distro);
		if (args.pages) {
			console.log(docs.pages.map((page) => page.slug).join("\n"));
			return undefined;
		}
		const slug = typeof args.slug === "string" ? args.slug.trim() : undefined;
		const index = slug === undefined ? 0 : docs.pageIndex(slug);
		if (index < 0) {
			throw new UsageError(`no page '${slug}' (--pages lists them)`);
		}
		return <InstallViewerScreen docs={docs} title={`${distro.osName} docs`} initialIndex={index} />;
	},
});
