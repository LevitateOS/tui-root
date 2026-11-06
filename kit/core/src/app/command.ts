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

/**
 * Runs `argv[0]` (looked up on PATH) with the app's own environment, capturing
 * stdout and stderr. The one way the apps run their backend tools.
 */
export function startCommand(argv: readonly string[]): RunningCommand {
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
		const result = Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]).then(([stdout, stderr, exitCode]) => done(exitCode, stdout, stderr));
		return { result, kill: () => proc.kill() };
	} catch (error) {
		return { result: Promise.resolve(done(null, "", errorMessage(error))), kill: () => {} };
	}
}

export function runCommand(argv: readonly string[]): Promise<CommandResult> {
	return startCommand(argv).result;
}
