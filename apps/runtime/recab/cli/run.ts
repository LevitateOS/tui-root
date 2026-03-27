import { startRuntimeRecabApp } from "../app/bootstrap";
import { cliHelpText, parseCliArgs } from "./parse-args";

export function runCli(args: string[] = process.argv.slice(2)): void {
  const options = parseCliArgs(args);

  if (options.help) {
    console.log(cliHelpText());
    return;
  }
  if (options.error) {
    console.error(options.error);
    process.exit(2);
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("runtime recab requires interactive TTY stdin/stdout. Run from a terminal.");
    process.exit(2);
  }

  const mounted = startRuntimeRecabApp({ recabBin: options.recabBin });
  void mounted.waitUntilExit().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`runtime recab exited with error: ${message}`);
    process.exit(1);
  });
}
