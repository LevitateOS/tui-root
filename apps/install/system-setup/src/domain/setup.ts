/**
 * The configuration step's model: the system being configured, what recsetup says can
 * be chosen, the answers so far, the plan and its run, and what each page and the rail
 * read from them. recsetup owns every rule (what a valid hostname is, what a step
 * runs); this file owns the order of the questions.
 */
import type { DiskResult } from "@levitate/install-state";
import type { ApplyResult, Choices, ErrorPayload, Inspect, Plan } from "./recsetup";

/** Where the system is, and where that came from. */
export type Target = {
	path: string;
	/** The disk step's result, when the install state file has one. */
	disk: DiskResult | null;
};

/** A run that failed: what ran, and recsetup's error when it printed one. */
export type Failure = {
	argv: readonly string[];
	exitCode: number | null;
	error: ErrorPayload | null;
	/** What it printed, when there is no error document. */
	output: string;
};

export type Run<T> =
	| { kind: "idle" }
	| { kind: "running"; argv: readonly string[] }
	| { kind: "ok"; argv: readonly string[]; value: T }
	| { kind: "failed"; failure: Failure };

/** `recsetup apply`: a failed one still lists every step, with the one that failed. */
export type Apply =
	| { kind: "idle" }
	| { kind: "running"; argv: readonly string[] }
	| { kind: "ok"; argv: readonly string[]; value: ApplyResult }
	| { kind: "failed"; failure: Failure; result: ApplyResult | null };

/** Saving the step to the install state file. */
export type Saved =
	| { kind: "ok"; path: string }
	| { kind: "failed"; path: string; message: string };

/** The questions, in the order they are asked. The keyboard comes first: it is loaded
 * on the live console at once, so the passwords are typed with it. */
export const FIELDS = ["keymap", "timezone", "locale", "hostname", "root", "user"] as const;
export type FieldId = (typeof FIELDS)[number];

/** The questions answered by choosing from a list. */
export type PickField = "keymap" | "timezone" | "locale";

export type Answers = {
	keymap: string | null;
	timezone: string | null;
	locale: string | null;
	hostname: string | null;
	/** Null: root gets no password. */
	rootPassword: string | null;
	/** Null: no user is created. */
	user: string | null;
	userPassword: string | null;
};

export const NO_ANSWERS: Answers = {
	keymap: null,
	timezone: null,
	locale: null,
	hostname: null,
	rootPassword: null,
	user: null,
	userPassword: null,
};

export type Session = {
	target: Target | null;
	inspect: Run<Inspect>;
	answers: Answers;
	/** The questions that have an answer ("no user" is one). */
	answered: Record<FieldId, boolean>;
	/** `loadkeys` for the chosen keymap on the live console; the value is the keymap. */
	liveKeymap: Run<string>;
	plan: Run<Plan>;
	apply: Apply;
	saved: Saved | null;
};

export const PAGE_IDS = ["overview", ...FIELDS, "review", "done"] as const;
export type PageId = (typeof PAGE_IDS)[number];

export type PageState = "done" | "running" | "failed" | "ready" | "waiting";

/** Each page's title, and the short name the rail gives it. */
export const PAGES: Record<PageId, { title: string; short: string }> = {
	overview: { title: "Overview", short: "Overview" },
	keymap: { title: "Keyboard layout", short: "Keyboard" },
	timezone: { title: "Time zone", short: "Time zone" },
	locale: { title: "Language", short: "Language" },
	hostname: { title: "Hostname", short: "Hostname" },
	root: { title: "Root password", short: "Root password" },
	user: { title: "User", short: "User" },
	review: { title: "Review and apply", short: "Apply" },
	done: { title: "Done", short: "Done" },
};

/** The pages that are steps, in order; the rail numbers them. */
export const STEP_PAGES = [...FIELDS, "review"] as const satisfies readonly PageId[];

export function isField(page: PageId): page is FieldId {
	return (FIELDS as readonly string[]).includes(page);
}

export function allAnswered(session: Session): boolean {
	return FIELDS.every((field) => session.answered[field]);
}

/** The first question without an answer. */
export function firstUnanswered(session: Session): FieldId | null {
	return FIELDS.find((field) => !session.answered[field]) ?? null;
}

/** Whether anyone could log in to the configured system: root with a password, or a
 * user (who always gets one, and is an administrator). */
export function canLogIn(answers: Answers): boolean {
	return answers.rootPassword !== null || (answers.user !== null && answers.userPassword !== null);
}

/** How far each page has got, for the rail. */
export function pageState(session: Session, page: PageId): PageState {
	if (page === "overview") {
		if (!session.target) return "failed";
		return session.inspect.kind === "ok"
			? "done"
			: session.inspect.kind === "failed"
				? "failed"
				: "running";
	}
	if (page === "done") {
		return session.saved?.kind === "ok"
			? "done"
			: session.saved?.kind === "failed"
				? "failed"
				: "waiting";
	}
	if (page === "review") {
		if (session.apply.kind === "ok") return "done";
		if (session.apply.kind === "running") return "running";
		if (session.apply.kind === "failed" || session.plan.kind === "failed") return "failed";
		return allAnswered(session) ? "ready" : "waiting";
	}
	if (session.answered[page]) return "done";
	return session.inspect.kind === "ok" && firstUnanswered(session) === page ? "ready" : "waiting";
}

/** The page the step is at: the first one not done. */
export function currentPage(session: Session): PageId {
	return PAGE_IDS.find((page) => pageState(session, page) !== "done") ?? "done";
}

/** What the page waits for, when it can't be answered or run yet. */
export function waitsFor(session: Session, page: PageId): string | null {
	if (!session.target)
		return "a target: finish the disk and base steps first, or start with --target";
	if (session.inspect.kind !== "ok") return "the system at the target to be read";
	if (page === "review" || page === "done") {
		const missing = firstUnanswered(session);
		if (missing) return `an answer: ${PAGES[missing].title.toLowerCase()}`;
	}
	if (page === "done" && session.apply.kind !== "ok") return "the configuration to be applied";
	return null;
}

/** What a list question offers, in recsetup's order. */
export function options(field: PickField, choices: Choices): string[] {
	switch (field) {
		case "keymap":
			return choices.keymaps;
		case "timezone":
			return choices.timezones.map((zone) => zone.name);
		case "locale":
			return choices.locales.map((locale) => locale.name);
	}
}

/** Where a list starts before anything is chosen. */
export const START_AT: Record<PickField, string> = {
	keymap: "us",
	timezone: "UTC",
	locale: "en_US.UTF-8",
};

/**
 * The options that contain `filter` (any case), those where it starts the name or a part
 * of it first: "ams" finds Europe/Amsterdam before anything with "ams" inside a word.
 */
export function matching(all: readonly string[], filter: string): string[] {
	const wanted = filter.trim().toLowerCase();
	if (!wanted) return [...all];
	const starts = (name: string) =>
		name
			.toLowerCase()
			.split(/[/_-]/)
			.some((part) => part.startsWith(wanted)) || name.toLowerCase().startsWith(wanted);
	const hits = all.filter((name) => name.toLowerCase().includes(wanted));
	return [...hits.filter(starts), ...hits.filter((name) => !starts(name))];
}

/** The rows of a list shown at once: `rows` of them around `index`. */
export function listWindow(
	count: number,
	index: number,
	rows: number,
): { start: number; end: number } {
	const size = Math.max(1, rows);
	const start = Math.max(0, Math.min(index - Math.floor(size / 2), count - size));
	return { start, end: Math.min(count, start + size) };
}

/** The plan's section names, as the review page titles them. */
export function sectionName(section: string): string {
	return section.replace(/_/g, " ");
}
