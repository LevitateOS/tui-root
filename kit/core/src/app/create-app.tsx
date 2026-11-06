import { defaultTuiTheme, type TuiTheme } from "../theme/tokens";
import { detectColorRuntime } from "../theme/colors";
import type { TuiAppContextValue } from "./app-provider";

export type CreateTuiAppOptions = {
	theme?: TuiTheme;
};

export type TuiApp = TuiAppContextValue;

export function createTuiApp(options: CreateTuiAppOptions = {}): TuiApp {
	return {
		theme: options.theme ?? defaultTuiTheme,
		colors: detectColorRuntime(process.env),
	};
}
