import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { useStdout } from "ink";
import { resolveIntentColor, type ColorRuntime } from "../theme/colors";
import type { ColorIntent, TuiTheme } from "../theme/tokens";

export type TuiAppContextValue = {
	/** The command name given to runApp. */
	name: string;
	theme: TuiTheme;
	colors: ColorRuntime;
	/** Ends the screen and hands `value` to the spec's `afterExit` (see `useHandOff`). */
	handOff: (value: unknown) => void;
};

const AppContext = createContext<TuiAppContextValue | undefined>(undefined);

type AppProviderProps = PropsWithChildren<{
	app: TuiAppContextValue;
}>;

export function AppProvider({ app, children }: AppProviderProps) {
	return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}

function useTuiApp(): TuiAppContextValue {
	const app = useContext(AppContext);
	if (!app) throw new Error("the kit's parts need runApp (it provides the theme)");
	return app;
}

/**
 * Ends the screen and gives `value` to the app's `afterExit`: how a screen hands the
 * terminal to another program (the hub starting a step) without a module global.
 */
export function useHandOff<T>(): (value: T) => void {
	return useTuiApp().handOff;
}

export function useTuiTheme(): TuiTheme {
	return useTuiApp().theme;
}

export function useTuiColors(): ColorRuntime {
	return useTuiApp().colors;
}

/** The colour of each intent in the app's theme (undefined when colour is off). */
export function useIntentColor(): (intent: ColorIntent) => string | undefined {
	const { theme, colors } = useTuiApp();
	return (intent) => resolveIntentColor(theme, intent, colors);
}

type TerminalSize = {
	columns: number;
	rows: number;
};

/** The terminal's size from Ink's stdout, updated on resize (80x24 when stdout is not a terminal). */
export function useTuiViewport(): TerminalSize {
	const { stdout } = useStdout();
	const read = (): TerminalSize => ({
		columns: Math.max(1, stdout.columns || 80),
		rows: Math.max(1, stdout.rows || 24),
	});
	const [size, setSize] = useState(read);
	useEffect(() => {
		const onResize = () => setSize(read());
		stdout.on("resize", onResize);
		return () => {
			stdout.off("resize", onResize);
		};
	}, [stdout]);
	return size;
}
