import type { ReactNode } from "react";
import { SyntaxLine } from "../blocks/shared/syntax-line";
import { COMMAND_COLORS } from "../theme/index";

type CommandLineRowProps = {
	line: string;
	width: number;
	prefix?: string;
	bold?: boolean;
};

export function CommandLineRow({
	line,
	width,
	prefix = "$ ",
	bold = true,
}: CommandLineRowProps): ReactNode {
	return (
		<SyntaxLine
			line={`${prefix}${line}`}
			color={COMMAND_COLORS.prompt}
			background={COMMAND_COLORS.background}
			width={width}
			bold={bold}
		/>
	);
}
