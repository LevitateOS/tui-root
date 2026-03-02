export type CliOptions = {
	recabBin: string;
	help: boolean;
	error: string | null;
};

export function parseCliArgs(args: string[]): CliOptions {
	let recabBin = "recab";
	let help = false;
	let error: string | null = null;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (arg === "--help" || arg === "-h") {
			help = true;
			continue;
		}

		if (arg === "--recab-bin") {
			const value = args[index + 1];
			if (!value || value.startsWith("-")) {
				error = "--recab-bin requires a value";
				break;
			}
			recabBin = value;
			index += 1;
			continue;
		}

		error = `unknown argument: ${arg}`;
		break;
	}

	return { recabBin, help, error };
}

export function cliHelpText(): string {
	return [
		"s06 postinstall-tools (recab runtime shell)",
		"",
		"Usage:",
		"  bun run index.ts",
		"  bun run index.ts -- --recab-bin /usr/bin/recab",
		"",
		"Options:",
		"  --recab-bin <path>   Recab binary path (default: recab from PATH)",
		"  -h, --help           Show this help",
		"",
		"Hotkeys:",
		"  j/k, arrows          Move action selection",
		"  enter                Execute selected action",
		"  r                    Refresh status",
		"  q, esc, ctrl-c       Quit",
	].join("\n");
}
