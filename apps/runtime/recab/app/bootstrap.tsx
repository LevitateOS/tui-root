import { createTuiApp, renderApp, type RenderedTuiApp } from "@levitate/tui-kit";
import { RuntimeRecabScreen } from "../presentation/runtime-recab-screen";

export type StartRuntimeRecabOptions = {
  recabBin: string;
};

export function startRuntimeRecabApp(options: StartRuntimeRecabOptions): RenderedTuiApp {
  const app = createTuiApp({ title: "levitate-runtime-recab" });
  return renderApp(<RuntimeRecabScreen recabBin={options.recabBin} />, {
    app,
    exitOnCtrlC: false,
  });
}
