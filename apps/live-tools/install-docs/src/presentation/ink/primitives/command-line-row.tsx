import type { ColorIntent } from "@levitate/tui-kit";
import type { ReactNode } from "react";
import { SyntaxLine } from "../blocks/shared/syntax-line";

type CommandLineRowProps = {
	line: string;
	width: number;
	rowIndex?: number;
	prefix?: string;
	fallbackIntent?: ColorIntent;
	backgroundIntent?: ColorIntent;
	bold?: boolean;
};

export function CommandLineRow({
	line,
	width,
	rowIndex = 0,
	prefix = "$ ",
	fallbackIntent = "commandPrompt",
	backgroundIntent = "commandBarBackground",
	bold = true,
}: CommandLineRowProps): ReactNode {
	void rowIndex;
	const fullLine = `${prefix}${line}`;

	return (
		<SyntaxLine
			line={fullLine}
			fallbackIntent={fallbackIntent}
			backgroundIntent={backgroundIntent}
			width={width}
			bold={bold}
		/>
	);
}
