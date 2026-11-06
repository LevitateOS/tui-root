import type { ColorIntent, RichTextRun } from "@levitate/tui-kit";

export function runsLength(runs: ReadonlyArray<RichTextRun>): number {
	return runs.reduce((total, run) => total + run.text.length, 0);
}

export function cloneRuns(runs: ReadonlyArray<RichTextRun>): RichTextRun[] {
	return runs.map((run) => ({ ...run }));
}

function takeRuns(runs: ReadonlyArray<RichTextRun>, width: number): RichTextRun[] {
	if (width <= 0) {
		return [];
	}

	const taken: RichTextRun[] = [];
	let consumed = 0;
	for (const run of runs) {
		if (consumed >= width) {
			break;
		}
		const remaining = width - consumed;
		if (run.text.length <= remaining) {
			taken.push({ ...run });
			consumed += run.text.length;
			continue;
		}
		taken.push({ ...run, text: run.text.slice(0, remaining) });
		consumed += remaining;
	}
	return taken;
}

export function truncateRunsToWidth(
	runs: ReadonlyArray<RichTextRun>,
	width: number,
	fallbackIntent: ColorIntent,
	backgroundIntent?: ColorIntent,
): RichTextRun[] {
	if (width <= 0) {
		return [];
	}
	if (runsLength(runs) <= width) {
		return cloneRuns(runs);
	}
	if (width === 1) {
		return [
			{
				text: "…",
				intent: fallbackIntent,
				backgroundIntent,
			},
		];
	}

	const truncated = takeRuns(runs, width - 1);
	truncated.push({
		text: "…",
		intent: fallbackIntent,
		backgroundIntent,
	});
	return truncated;
}

/** Gives every run without its own background `backgroundIntent`. */
export function withBackgroundIntent(
	runs: ReadonlyArray<RichTextRun>,
	backgroundIntent: ColorIntent,
): RichTextRun[] {
	return runs.map((run) => ({
		...run,
		backgroundIntent: run.backgroundIntent ?? backgroundIntent,
	}));
}

export function padRunsToWidth(
	runs: ReadonlyArray<RichTextRun>,
	width: number,
	fallbackIntent: ColorIntent,
	backgroundIntent?: ColorIntent,
): RichTextRun[] {
	const padded = cloneRuns(runs);
	const missing = width - runsLength(padded);
	if (missing <= 0) {
		return padded;
	}
	padded.push({
		text: " ".repeat(missing),
		intent: fallbackIntent,
		backgroundIntent,
	});
	return padded;
}
