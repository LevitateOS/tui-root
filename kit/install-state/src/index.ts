/**
 * The install's shared state file: what each finished step did, so the next step's app
 * reads it instead of asking again, the hub shows where the install stands, and a crashed
 * app can resume. It lives under /run, so it lasts as long as the live session.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const STATE_SCHEMA = 1;
export const DEFAULT_STATE_PATH = "/run/levitate-install/state.json";
/** Points the apps at another state file (stories, tests, a second install). */
export const STATE_PATH_ENV = "LEVITATE_INSTALL_STATE";

/** The install steps, in order. */
export const STEP_NAMES = ["preflight", "disk", "base", "setup", "boot"] as const;
export type StepName = (typeof STEP_NAMES)[number];

/** The disk step: recpart's handoff, as the later steps need it. */
export interface DiskResult {
	disk: string;
	mode: "ab" | "mutable";
	/** Where the installed system's root is mounted (recstrap's target). */
	target: string;
	mounts: { path: string; device: string }[];
	/** A/B: the two system slots' devices. */
	slot_a: string | null;
	slot_b: string | null;
	/** The device mounted at `target` (mutable: the root device for the boot entry). */
	root_device: string | null;
}

export interface StepResults {
	preflight: unknown;
	disk: DiskResult;
	base: unknown;
	setup: unknown;
	boot: unknown;
}

export interface StepRecord<T> {
	/** ISO 8601 time the step finished. */
	done_at: string;
	result: T;
}

export interface InstallState {
	schema: typeof STATE_SCHEMA;
	steps: { [S in StepName]?: StepRecord<StepResults[S]> };
}

export function statePath(env: Record<string, string | undefined> = process.env): string {
	return env[STATE_PATH_ENV]?.trim() || DEFAULT_STATE_PATH;
}

/** The state so far; an install that has not started has no file, which reads as no steps. */
export function readState(path = statePath()): InstallState {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return { schema: STATE_SCHEMA, steps: {} };
		throw error;
	}
	const state = JSON.parse(text) as Partial<InstallState>;
	if (state.schema !== STATE_SCHEMA || typeof state.steps !== "object" || state.steps === null) {
		throw new Error(
			`${path} is not an install state file of schema ${STATE_SCHEMA}; remove it to start the install over`,
		);
	}
	return state as InstallState;
}

/**
 * Records `step` as done with `result`, atomically. The steps after it are dropped: they
 * built on what this step replaced (a new disk layout needs a new base system).
 */
export function recordStep<S extends StepName>(
	step: S,
	result: StepResults[S],
	path = statePath(),
	now = new Date(),
): InstallState {
	const state = readState(path);
	const later = STEP_NAMES.slice(STEP_NAMES.indexOf(step) + 1);
	for (const name of later) delete state.steps[name];
	state.steps[step] = { done_at: now.toISOString(), result } as InstallState["steps"][S];
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(state, null, "\t")}\n`, { mode: 0o600 });
	renameSync(tmp, path);
	return state;
}
