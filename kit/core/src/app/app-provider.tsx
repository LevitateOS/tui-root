import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { useStdout } from "ink";
import type { ColorRuntime } from "../theme/colors";
import type { TuiTheme } from "../theme/tokens";

export type TuiAppContextValue = {
	theme: TuiTheme;
	colors: ColorRuntime;
};

const AppContext = createContext<TuiAppContextValue | null>(null);

type AppProviderProps = PropsWithChildren<{
	app: TuiAppContextValue;
}>;

export function AppProvider({ app, children }: AppProviderProps) {
	return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}

function useTuiApp(): TuiAppContextValue {
	const value = useContext(AppContext);
	if (!value) {
		throw new Error("useTuiApp must be used inside <AppProvider>.");
	}
	return value;
}

export function useTuiTheme(): TuiTheme {
	return useTuiApp().theme;
}

export function useTuiColors(): ColorRuntime {
	return useTuiApp().colors;
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
