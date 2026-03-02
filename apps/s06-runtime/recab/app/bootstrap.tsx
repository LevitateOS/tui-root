import { createTuiApp, renderApp, type RenderedTuiApp } from "@levitate/tui-kit";
import { RuntimeRecabScreen } from "../presentation/runtime-recab-screen";

export type StartPostinstallToolsOptions = {
	recabBin: string;
};

export function startPostinstallToolsApp(
	options: StartPostinstallToolsOptions,
): RenderedTuiApp {
	const app = createTuiApp({ title: "levitate-s06-postinstall-tools" });
	return renderApp(<RuntimeRecabScreen recabBin={options.recabBin} />, {
		app,
		exitOnCtrlC: false,
	});
}
