import { Text } from "ink";
import type { ReactNode } from "react";
import { useTuiColors, useTuiTheme } from "../../app/app-provider";
import { legibleIntent, resolveIntentColor } from "../../theme/colors";
import { useSurfaceBackground } from "./cells";
import { type ColorIntent } from "../../theme/tokens";

type UiTextProps = {
	children: ReactNode;
	intent?: ColorIntent;
	bold?: boolean;
};

export function UiText({ children, intent = "text", bold = false }: UiTextProps) {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	// Quiet text on a raised panel or a fill turns legible; on a pane's surface it stays quiet.
	const color = resolveIntentColor(
		theme,
		legibleIntent(theme, intent, useSurfaceBackground()),
		colors,
	);

	return (
		<Text color={color} bold={bold}>
			{children}
		</Text>
	);
}
