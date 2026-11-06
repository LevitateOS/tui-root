import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { useStdout } from "ink";
import type { ColorRuntime } from "../theme/colors";
import { defaultTuiTheme, type TuiTheme } from "../theme/tokens";

export type TuiAppContextValue = {
	/** The command name given to runApp. */
	name: string;
	theme: TuiTheme;
	colors: ColorRuntime;
};

/** Without a provider (outside runApp) atoms render with the default theme and colour on. */
const AppContext = createContext<TuiAppContextValue>({
	name: "tui",
	theme: defaultTuiTheme,
	colors: { enabled: true },
});

type AppProviderProps = PropsWithChildren<{
	app: TuiAppContextValue;
}>;

export function AppProvider({ app, children }: AppProviderProps) {
	return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}

function useTuiApp(): TuiAppContextValue {
	return useContext(AppContext);
}

export function useAppName(): string {
	return useTuiApp().name;
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
