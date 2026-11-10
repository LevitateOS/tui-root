/**
 * The install's shared state file: what each finished step did, so the next step's app
 * reads it instead of asking again, the hub shows where the install stands, and a crashed
 * app can resume. It lives under /run, so it lasts as long as the live session.
 *
 * The steps and their results are the install procedure's (`@levitate/docs-content/install`);
 * this file only stores them, and refuses a file whose steps don't have those shapes.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	RECORDED_STEPS,
	type DiskResult,
	type RecordedStep,
	type StepResults,
} from "@levitate/docs-content/install";

export type { DiskResult, RecordedStep as StepName, StepResults };
export type BaseResult = StepResults["base"];
export type SetupResult = StepResults["setup"];

export const STATE_SCHEMA = 1;
export const DEFAULT_STATE_PATH = "/run/install/state.json";
/** Points the apps at another state file (stories, tests, a second install). */
export const STATE_PATH_ENV = "INSTALL_STATE";

/** The install steps whose results are kept, in order. */
export const STEP_NAMES = RECORDED_STEPS;

export interface StepRecord<T> {
	/** ISO 8601 time the step finished. */
	done_at: string;
	result: T;
}

export interface InstallState {
	schema: typeof STATE_SCHEMA;
	steps: { [S in RecordedStep]?: StepRecord<StepResults[S]> };
}

export function emptyState(): InstallState {
	return { schema: STATE_SCHEMA, steps: {} };
}

export function statePath(env: Record<string, string | undefined> = process.env): string {
	return env[STATE_PATH_ENV]?.trim() || DEFAULT_STATE_PATH;
}

type Shape = "string" | "string?" | "number?" | "true" | "boolean" | "mode" | "mounts";

/** The fields each step's result must have. */
const SHAPES: { [S in RecordedStep]: { [K in keyof StepResults[S]]-?: Shape } } = {
	preflight: { uefi: "true", media: "true" },
	disk: {
		disk: "string",
		mode: "mode",
		target: "string",
		mounts: "mounts",
		slot_a: "string?",
		slot_b: "string?",
		root_device: "string?",
	},
	base: { target: "string", rootfs: "string?", entries: "number?", fstab: "string" },
	setup: { manual: "boolean", hostname: "string?", user: "string?" },
	boot: { mode: "mode" },
};

function fits(value: unknown, shape: Shape): boolean {
	switch (shape) {
		case "string":
			return typeof value === "string" && value.length > 0;
		case "string?":
			return value === null || (typeof value === "string" && value.length > 0);
		case "number?":
			return value === null || (typeof value === "number" && Number.isFinite(value));
		case "true":
			return value === true;
		case "boolean":
			return typeof value === "boolean";
		case "mode":
			return value === "ab" || value === "mutable";
		case "mounts":
			return (
				Array.isArray(value) &&
				value.every(
					(m) =>
						typeof m === "object" &&
						m !== null &&
						typeof m.path === "string" &&
						typeof m.device === "string",
				)
			);
	}
}

/** What is wrong with `steps`, or null when every recorded step has its result's shape. */
function invalidStep(steps: Record<string, unknown>): string | null {
	for (const [name, record] of Object.entries(steps)) {
		if (!(STEP_NAMES as readonly string[]).includes(name)) return `unknown step '${name}'`;
		const entry = record as { done_at?: unknown; result?: unknown } | null;
		if (typeof entry?.done_at !== "string") return `step '${name}' has no done_at`;
		const result = entry.result as Record<string, unknown> | null;
		if (typeof result !== "object" || result === null) return `step '${name}' has no result`;
		for (const [field, shape] of Object.entries(SHAPES[name as RecordedStep])) {
			if (!fits(result[field], shape as Shape)) {
				return `step '${name}': result.${field} is missing or not ${shape.replace("?", " or null")}`;
			}
		}
	}
	return null;
}

/**
 * The state so far; an install that has not started has no file, which reads as no
 * steps. A file that is not a state file of this schema, or has a step whose result is
 * malformed, is refused with what is wrong.
 */
export function readState(path = statePath()): InstallState {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
		throw error;
	}
	const refuse = (why: string) =>
		new Error(
			`${path} is not a usable install state file (${why}); remove it to start the install over`,
		);
	let state: Partial<InstallState>;
	try {
		state = JSON.parse(text) as Partial<InstallState>;
	} catch (error) {
		throw refuse((error as Error).message);
	}
	if (state.schema !== STATE_SCHEMA) throw refuse(`schema is not ${STATE_SCHEMA}`);
	if (typeof state.steps !== "object" || state.steps === null) throw refuse("no steps");
	const invalid = invalidStep(state.steps as Record<string, unknown>);
	if (invalid) throw refuse(invalid);
	return state as InstallState;
}

/**
 * Records `step` as done with `result`, atomically. The steps after it are dropped: they
 * built on what this step replaced (a new disk layout needs a new base system).
 */
export function recordStep<S extends RecordedStep>(
	step: S,
	result: StepResults[S],
	path = statePath(),
	now = new Date(),
): InstallState {
	const state = readState(path);
	const later = STEP_NAMES.slice(STEP_NAMES.indexOf(step) + 1);
	for (const name of later) delete state.steps[name];
	(state.steps as Record<string, StepRecord<unknown>>)[step] = {
		done_at: now.toISOString(),
		result,
	};
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(state, null, "\t")}\n`, { mode: 0o600 });
	renameSync(tmp, path);
	return state;
}

/** Where a step app sends the user when its step is done: back to install-hub, or to the shell it was typed in. */
export type Then = "hub" | "shell";
/** The `--then` flag of a step app; install-hub passes `--then hub`. */
export const THEN_FLAG = {
	name: "then",
	value: "WHERE",
	choices: ["hub", "shell"],
	help: "where the next step is started: hub (install-hub started this app) or shell (default)",
} as const;
