import { MARKERS } from "../theme/index";
import { Box, Text } from "ink";
import type { CommandBlock } from "@levitate/docs-content";
import { wrapText } from "@levitate/tui-kit";
import type { ReactNode } from "react";
import type { BlockComponentProps } from "./types";
import type { BlockPlugin } from "./contracts";
import { commandSnapshotLines } from "./shared/content-utils";
import { useIntentColor } from "./shared/intent-color";
import { defaultDocsBlockRendererKey } from "./shared/renderer-key";
import { CommandLineSeries } from "../primitives/command-line-series";

export function CommandBlockView({
	block,
	contentWidth,
	indent = 0,
	isSelected = false,
}: BlockComponentProps<CommandBlock>): ReactNode {
	const safeWidth = Math.max(1, contentWidth);
	const textWidth = Math.max(1, safeWidth - indent);
	const panelBackground = useIntentColor("panelBackground");
	const descriptionColor = useIntentColor(isSelected ? "accent" : "dimText");
	const dimTextColor = useIntentColor("dimText");
	const commandLines = commandSnapshotLines(block);
	const selectedCommandLines =
		isSelected && commandLines.length > 0
			? [`${commandLines[0]}  [COPY]`, ...commandLines.slice(1)]
			: commandLines;
	const descriptionLines = wrapText(block.description, textWidth);
	const outputLines =
		typeof block.output === "string" && block.output.length > 0
			? block.output.split("\n").flatMap((line) => wrapText(line, textWidth))
			: [];

	return (
		<Box flexDirection="column" paddingLeft={indent} width={safeWidth}>
			{descriptionLines.map((line, index) => (
				<Text
					key={`command-description-${index}`}
					color={descriptionColor}
					backgroundColor={panelBackground}
				>
					{line}
				</Text>
			))}
			<CommandLineSeries
				lines={selectedCommandLines}
				width={textWidth}
				firstPrefix={isSelected ? `${MARKERS.selected} ` : "$ "}
				continuationPrefix="  "
				bold
			/>
			{outputLines.map((line, outputIndex) => (
				<Text key={`output-${outputIndex}`} color={dimTextColor} backgroundColor={panelBackground}>
					{line}
				</Text>
			))}
		</Box>
	);
}

export const commandBlockPlugin: BlockPlugin<"command"> = {
	type: "command",
	rendererKey: defaultDocsBlockRendererKey("command"),
	render: (block, context, indent) => (
		<CommandBlockView
			block={block}
			contentWidth={context.contentWidth}
			indent={indent}
			isSelected={context.isSelected}
		/>
	),
	measure: (block, context, indent) => {
		const textWidth = Math.max(1, context.contentWidth - indent);
		const descriptionLines = wrapText(block.description, textWidth).length;
		const commandLines = commandSnapshotLines(block).length;
		const outputLines =
			typeof block.output === "string" && block.output.length > 0
				? block.output.split("\n").flatMap((line) => wrapText(line, textWidth)).length
				: 0;
		return descriptionLines + commandLines + outputLines;
	},
};
