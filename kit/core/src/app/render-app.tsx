import { render } from "ink";
import type { ReactElement } from "react";
import { createTuiApp, type CreateTuiAppOptions, type TuiApp } from "./create-app";
import { AppProvider } from "./app-provider";
import { ErrorBoundary } from "./error-boundary";

type RenderAppOptions = CreateTuiAppOptions & {
	app?: TuiApp;
	exitOnCtrlC?: boolean;
};

type InkRenderHandle = {
	unmount: () => void;
	waitUntilExit: () => Promise<void>;
	rerender?: (element: ReactElement) => void;
};

export type RenderedTuiApp = {
	app: TuiApp;
	unmount: () => void;
	waitUntilExit: () => Promise<void>;
	rerender: (element: ReactElement) => void;
};

function wrapWithProvider(app: TuiApp, element: ReactElement): ReactElement {
	return (
		<AppProvider app={app}>
			<ErrorBoundary>{element}</ErrorBoundary>
		</AppProvider>
	);
}

export function renderApp(element: ReactElement, options: RenderAppOptions = {}): RenderedTuiApp {
	const app =
		options.app ??
		createTuiApp({
			theme: options.theme,
		});

	const handle = render(wrapWithProvider(app, element), {
		exitOnCtrlC: options.exitOnCtrlC ?? false,
	}) as unknown as InkRenderHandle;

	let unmounted = false;

	const unmount = () => {
		if (unmounted) {
			return;
		}
		unmounted = true;
		handle.unmount();
	};

	return {
		app,
		unmount,
		waitUntilExit: async () => {
			await handle.waitUntilExit();
		},
		rerender: (nextElement: ReactElement) => {
			handle.rerender?.(wrapWithProvider(app, nextElement));
		},
	};
}
