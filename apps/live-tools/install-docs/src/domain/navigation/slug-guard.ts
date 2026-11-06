export function guardRequestedSlug(
	requestedSlug: string | undefined,
	allowedSlugs: ReadonlyArray<string>,
): string | undefined {
	if (!requestedSlug) {
		return undefined;
	}

	const normalized = requestedSlug.trim();
	if (allowedSlugs.includes(normalized)) {
		return normalized;
	}

	throw new Error(`Slug '${normalized}' is not available in docs navigation.`);
}
