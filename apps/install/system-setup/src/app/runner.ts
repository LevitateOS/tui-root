/** The commands the configuration step runs, and the install state file it reads and writes. */
import { readState, recordStep, statePath, type SetupResult } from "@levitate/install-state";
import { errorMessage, type CommandResult } from "@levitate/tui-kit";
import {
	readDocument,
	readErrorPayload,
	type ApplyResult,
	type ErrorPayload,
	type Inspect,
	type Plan,
} from "../domain/recsetup";
import type { Answers, Apply, Failure, Run, Saved, Target } from "../domain/setup";

export function inspectCommand(target: string): string[] {
	return ["recsetup", "inspect", "--root", target, "--json"];
}

/** What of the answers recsetup is asked for. A password is never an argument:
 * `--root-password` and `--user` only say whose are set, and apply reads them from stdin. */
export type Request = Partial<
	Pick<Answers, "keymap" | "timezone" | "locale" | "hostname" | "user">
> & {
	rootPassword?: boolean;
	/** The user the desktop logs in by itself; null or absent: the login screen asks. */
	autologin?: string | null;
};

export function requestOf(answers: Answers): Request {
	return {
		keymap: answers.keymap,
		timezone: answers.timezone,
		locale: answers.locale,
		hostname: answers.hostname,
		user: answers.user,
		rootPassword: answers.rootPassword !== null,
		autologin: answers.autologin ? answers.user : null,
	};
}

function requestArgs(request: Request): string[] {
	return [
		...(request.timezone ? ["--timezone", request.timezone] : []),
		...(request.locale ? ["--locale", request.locale] : []),
		...(request.keymap ? ["--keymap", request.keymap] : []),
		...(request.hostname ? ["--hostname", request.hostname] : []),
		...(request.rootPassword ? ["--root-password"] : []),
		...(request.user ? ["--user", request.user] : []),
		...(request.autologin ? ["--autologin", request.autologin] : []),
	];
}

/** The exact commands for `request`, run by nothing; also how one answer is checked. */
export function planCommand(target: string, request: Request): string[] {
	return ["recsetup", "plan", "--root", target, ...requestArgs(request), "--json"];
}

export function applyCommand(target: string, request: Request): string[] {
	const passwords = request.rootPassword || Boolean(request.user);
	return [
		"recsetup",
		"apply",
		"--root",
		target,
		...requestArgs(request),
		...(passwords ? ["--passwords-stdin"] : []),
		"--json",
	];
}

/** apply's stdin: one `name:password` line for each account whose password is set. */
export function passwordLines(answers: Answers): string | undefined {
	const lines = [
		answers.rootPassword !== null ? `root:${answers.rootPassword}` : null,
		answers.user !== null && answers.userPassword !== null
			? `${answers.user}:${answers.userPassword}`
			: null,
	].filter((line) => line !== null);
	return lines.length > 0 ? `${lines.join("\n")}\n` : undefined;
}

/** Loads a console keymap on the live system (kbd's `loadkeys`, on every image). */
export function liveKeymapCommand(keymap: string): string[] {
	return ["loadkeys", keymap];
}

/** What a failed run left: its error document, or what it printed. */
export function failure(
	result: CommandResult,
	note?: string,
	error: ErrorPayload | null = readErrorPayload(result.stderr),
): Failure {
	return {
		argv: result.argv,
		exitCode: result.exitCode,
		error,
		output: [note, (result.stderr || result.stdout).trim()].filter(Boolean).join("\n"),
	};
}

/** A finished run that prints one document of recsetup's schema on stdout. */
function toRun<T extends { schema_version: number }>(result: CommandResult): Run<T> {
	if (result.exitCode !== 0) return { kind: "failed", failure: failure(result) };
	const value = readDocument<T>(result.stdout);
	return value
		? { kind: "ok", argv: result.argv, value }
		: {
				kind: "failed",
				failure: failure(
					result,
					"recsetup printed no document this app reads (another schema version?)",
				),
			};
}

export const toInspect = (result: CommandResult): Run<Inspect> => toRun<Inspect>(result);
export const toPlan = (result: CommandResult): Run<Plan> => toRun<Plan>(result);

/** A finished `recsetup apply --json`: its document lists the steps even when one failed. */
export function toApply(result: CommandResult): Apply {
	const value = readDocument<ApplyResult>(result.stdout);
	if (result.exitCode === 0 && value && !value.error)
		return { kind: "ok", argv: result.argv, value };
	return {
		kind: "failed",
		result: value,
		failure: failure(
			result,
			result.exitCode === 0 ? "recsetup apply printed no result" : undefined,
			readErrorPayload(result.stderr) ?? value?.error ?? null,
		),
	};
}

/** Where the system is: `--target`, else the disk step's target. Also the state file's
 * error, when it can't be read. */
export function findTarget(flag: string): { target: Target | null; error: string | null } {
	let disk = null;
	let error = null;
	try {
		disk = readState().steps.disk?.result ?? null;
	} catch (e) {
		error = errorMessage(e);
	}
	const path = flag.trim() || disk?.target || null;
	if (!path) return { target: null, error };
	return { target: { path, disk: disk && disk.target === path ? disk : null }, error };
}

/** Records the setup step. */
export function saveSetupStep(result: SetupResult): Saved {
	const path = statePath();
	try {
		recordStep("setup", result, path);
		return { kind: "ok", path };
	} catch (error) {
		return { kind: "failed", path, message: errorMessage(error) };
	}
}
