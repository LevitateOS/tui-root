import {
	resolveColor,
	resolveIntentColor,
	useTuiColors,
	useTuiTheme,
	type ColorIntent,
	type ThemeColor,
} from "@levitate/tui-kit";

export function useIntentColor(intent: ColorIntent): string | undefined {
	return resolveIntentColor(useTuiTheme(), intent, useTuiColors());
}

/** A literal theme colour through the same runtime (NO_COLOR turns it off). */
export function useColor(color: ThemeColor | string | undefined): string | undefined {
	return resolveColor(color, useTuiColors());
}
