import { startPostinstallToolsApp } from "../app/bootstrap";
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
		console.error(
			"s06 postinstall-tools requires interactive TTY stdin/stdout. Run from a terminal.",
		);
		process.exit(2);
	}

	const mounted = startPostinstallToolsApp({ recabBin: options.recabBin });
	void mounted.waitUntilExit().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`s06 postinstall-tools exited with error: ${message}`);
		process.exit(1);
	});
}
