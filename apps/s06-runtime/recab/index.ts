#!/usr/bin/env bun

export { startPostinstallToolsApp } from "./app/bootstrap";
export { runRecabCommand, runRecabStatus } from "./app/recab-runner";
export { cliHelpText, parseCliArgs, type CliOptions } from "./cli/parse-args";
export { runCli } from "./cli/run";
export {
	parseRecabStatusJson,
	type RecabCommandSpec,
	type RecabCommandResult,
	type RecabStatus,
	type Slot,
} from "./domain";
export {
	RUNTIME_RECAB_ACTIONS,
	type RuntimeRecabAction,
	type RuntimeRecabActionId,
} from "./flows";

import { runCli } from "./cli/run";

if (import.meta.main) {
	runCli();
}
