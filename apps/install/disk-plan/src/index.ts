#!/usr/bin/env bun

export { buildPlanCommand, runRecpartPlan } from "./app/plan-runner";
export { cliHelpText, parseCliArgs } from "./cli/parse-args";
export { runCli } from "./cli/run";

import { runCli } from "./cli/run";

if (import.meta.main) {
  runCli();
}
