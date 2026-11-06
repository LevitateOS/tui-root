import { errorMessage, UsageError } from "@levitate/tui-kit";
import type { ReactElement } from "react";
import { createMappedDocsSource } from "../adapters/docs-content/mapper";
import { contentForSlug } from "../domain/content/index";
import { getDistroProfile } from "../domain/distro/registry";
import type { DistroId } from "../domain/distro/profile";
import { createInstallSession } from "./session";
import { InstallViewerScreen } from "../presentation/ink/screens/install-viewer";
import { createInstallDocsRendererRegistry } from "../presentation/ink/document/renderer-registry";

type StartInstallDocsOptions = {
	slug?: string;
	distro?: DistroId;
};

/** The slugs of every page the viewer can show, in nav order. */
export function listPageSlugs(): string[] {
	const session = createInstallSession(createMappedDocsSource(), getDistroProfile("levitate"));
	return session.navItems.map((item) => item.slug);
}

/** The viewer for `slug` (or the default page); an unknown slug is a usage error. */
export function installDocsScreen(options: StartInstallDocsOptions = {}): ReactElement {
	const profile = getDistroProfile(options.distro ?? "levitate");
	let session;
	try {
		session = createInstallSession(createMappedDocsSource(), profile, options.slug);
	} catch (error: unknown) {
		throw new UsageError(errorMessage(error));
	}
	return (
		<InstallViewerScreen
			navItems={session.navItems}
			getContent={(slug, title) => contentForSlug(session.source, slug, title)}
			initialSlug={session.initialSlug}
			renderers={createInstallDocsRendererRegistry()}
		/>
	);
}
