export function uniqueStrings(values: ReadonlyArray<string>): string[] {
	return Array.from(
		new Set(
			values
				.map((value) => (typeof value === "string" ? value.trim() : ""))
				.filter((value) => value.length > 0),
		),
	);
}
