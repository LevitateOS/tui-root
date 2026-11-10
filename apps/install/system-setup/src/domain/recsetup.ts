/**
 * recsetup's JSON documents, as far as this app reads them: `inspect`, `plan` and
 * `apply` with `--json`, and the error a failed run prints on stderr. Written by hand
 * from recsetup's Rust types (tools/recstrap/src/bin/recsetup: target.rs, plan.rs,
 * apply.rs; src/output.rs) until `cargo xtask gen` writes them; every document carries
 * `schema_version`, and one of another version is not read.
 */

export const SETUP_SCHEMA_VERSION = 1 as const;

export type ErrorPayload = {
	schema_version: number;
	/** `E0NN`; its number is the exit status. */
	code: string;
	message: string;
	/** What to do about it, when the message alone does not say. */
	remediation?: string;
};

/** The extracted system recsetup found at the root. */
export type TargetInfo = {
	root: string;
	os_id: string;
	os_name: string;
	admin: { group: string; tool: string };
	/** The time zone database is installed (without it only UTC exists). */
	has_zoneinfo: boolean;
	/** The shell of new users: root's login shell in the target. */
	default_shell: string;
};

/** What the target offers to choose from. */
export type Choices = {
	timezones: { name: string; region: string }[];
	locales: { name: string }[];
	keymaps: string[];
	users: string[];
};

export type Inspect = { schema_version: number; target: TargetInfo; choices: Choices };

export type PlanStep = {
	index: number;
	/** `timezone`, `locale`, `keymap`, `hostname`, `users`, `passwords`, ... */
	section: string;
	description: string;
	/** The shell command this step is. */
	command: string;
};

export type Plan = {
	schema_version: number;
	steps: PlanStep[];
	/** Things that do not stop the plan but are worth a look first. */
	warnings: string[];
	/** The accounts whose passwords apply reads from stdin, in order. */
	password_users: string[];
};

export type StepRecord = PlanStep & {
	status: "planned" | "done" | "failed" | "not_run";
	exit_status?: number;
	stdout?: string;
	stderr?: string;
};

export type ApplyResult = {
	schema_version: number;
	dry_run: boolean;
	steps: StepRecord[];
	warnings: string[];
	/** The failure that stopped apply; null when every step ran. */
	error: ErrorPayload | null;
};

/** A document recsetup printed on stdout; null when it isn't one of this schema. */
export function readDocument<T extends { schema_version: number }>(stdout: string): T | null {
	try {
		const value = JSON.parse(stdout) as Partial<T> | null;
		return value?.schema_version === SETUP_SCHEMA_VERSION ? (value as T) : null;
	} catch {
		return null;
	}
}

/** A failed run's error: the last JSON object on stderr (a step's own messages can come
 * before it); null when there is none. */
export function readErrorPayload(stderr: string): ErrorPayload | null {
	const trimmed = stderr.trim();
	const start = trimmed.lastIndexOf("\n{");
	const text = start >= 0 ? trimmed.slice(start + 1) : trimmed.startsWith("{") ? trimmed : "";
	return readDocument<ErrorPayload>(text);
}
