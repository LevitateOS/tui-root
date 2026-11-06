import { Text } from "ink";
import type { ColorIntent } from "../../theme/tokens";
import type { RichTextRun } from "../../utils/runs";
import { useTuiColors, useTuiTheme } from "../../app/app-provider";
import { resolveColor, resolveIntentColor } from "../../theme/colors";

type RichTextLineProps = {
	runs: ReadonlyArray<RichTextRun>;
	fallbackIntent?: ColorIntent;
};

/** One line of styled runs. An empty line still takes its row. */
export function RichTextLine({ runs, fallbackIntent = "text" }: RichTextLineProps) {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	if (runs.length === 0) {
		return <Text> </Text>;
	}
	return (
		<Text>
			{runs.map((run, index) => (
				<Text
					key={`${index}-${run.text}`}
					color={
						run.color
							? resolveColor(run.color, colors)
							: resolveIntentColor(theme, run.intent ?? fallbackIntent, colors)
					}
					backgroundColor={
						run.background
							? resolveColor(run.background, colors)
							: run.backgroundIntent && resolveIntentColor(theme, run.backgroundIntent, colors)
					}
					bold={run.bold}
					italic={run.italic}
					underline={run.underline}
				>
					{run.text}
				</Text>
			))}
		</Text>
	);
}
