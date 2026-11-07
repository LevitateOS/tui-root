import { errorMessage } from "../utils/strings";

export type CommandResult = {
	argv: readonly string[];
	/** null when the program could not be started (the reason is in `stderr`). */
	exitCode: number | null;
	stdout: string;
	stderr: string;
	durationMs: number;
};

export type RunningCommand = {
	result: Promise<CommandResult>;
	kill: () => void;
};

export type CommandOptions = {
	/** Called with each line of stdout as it arrives (without the newline); the whole
	 * stdout is still in the result. */
	onLine?: (line: string) => void;
};

/** Reads `stream` to the end, handing each complete line to `onLine`. */
async function readLines(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void) {
	const decoder = new TextDecoder();
	let text = "";
	let pending = "";
	for await (const chunk of stream) {
		const piece = decoder.decode(chunk, { stream: true });
		text += piece;
		const lines = (pending + piece).split("\n");
		pending = lines.pop() ?? "";
		for (const line of lines) onLine(line);
	}
	const rest = pending + decoder.decode();
	text += rest.slice(pending.length);
	if (rest) onLine(rest);
	return text;
}

/**
 * Runs `argv[0]` (looked up on PATH) with the app's own environment, capturing
 * stdout and stderr. The one way the apps run their backend tools.
 */
export function startCommand(
	argv: readonly string[],
	options: CommandOptions = {},
): RunningCommand {
	const startedAt = Date.now();
	const done = (exitCode: number | null, stdout: string, stderr: string): CommandResult => ({
		argv,
		exitCode,
		stdout,
		stderr,
		durationMs: Date.now() - startedAt,
	});
	try {
		const proc = Bun.spawn([...argv], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
		const { onLine } = options;
		const result = Promise.all([
			onLine ? readLines(proc.stdout, onLine) : new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]).then(([stdout, stderr, exitCode]) => done(exitCode, stdout, stderr));
		return { result, kill: () => proc.kill() };
	} catch (error) {
		return { result: Promise.resolve(done(null, "", errorMessage(error))), kill: () => {} };
	}
}

export function runCommand(
	argv: readonly string[],
	options: CommandOptions = {},
): Promise<CommandResult> {
	return startCommand(argv, options).result;
}
