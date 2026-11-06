import { defaultTuiTheme, type ColorMode, type TuiTheme } from "../theme/tokens";
import { detectColorRuntime, type ColorRuntime } from "../theme/colors";
import type { TuiAppContextValue } from "./app-provider";

export type CreateTuiAppOptions = {
	theme?: TuiTheme;
	colorMode?: ColorMode;
	colorEnabled?: boolean;
};

export type TuiApp = TuiAppContextValue;

export function createTuiApp(options: CreateTuiAppOptions = {}): TuiApp {
	const theme = options.theme ?? defaultTuiTheme;
	const colors: ColorRuntime = detectColorRuntime({
		mode: options.colorMode,
		enabled: options.colorEnabled,
	});

	return {
		theme,
		colors,
	};
}
