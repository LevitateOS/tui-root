import type { RichTextRun } from "./rich-text";

type LinkRunOptions = {
	href?: string;
	isSelected?: boolean;
	includeHrefWhenDifferent?: boolean;
};

export function linkRuns(label: string, options: LinkRunOptions = {}): RichTextRun[] {
	const href = options.href?.trim() ?? "";
	const isSelected = options.isSelected ?? false;
	const includeHref =
		(options.includeHrefWhenDifferent ?? true) && href.length > 0 && href !== label;
	const foregroundIntent = isSelected ? "linkActiveText" : "linkText";
	const backgroundIntent = isSelected ? "linkActiveBackground" : undefined;

	const runs: RichTextRun[] = [
		{
			text: label,
			intent: foregroundIntent,
			backgroundIntent,
			underline: true,
			bold: isSelected,
		},
	];

	if (includeHref) {
		runs.push({
			text: ` (${href})`,
			intent: foregroundIntent,
			backgroundIntent,
			bold: false,
		});
	}

	return runs;
}
