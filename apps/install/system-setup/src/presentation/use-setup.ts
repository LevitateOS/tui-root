/** The screen's state: the system, the answers, the question being asked, and the runs. */
import { useEffect, useMemo, useRef, useState } from "react";
import { distroByOsId } from "@levitate/docs-content/distros";
import { runCommand } from "@levitate/tui-kit";
import {
	applyCommand,
	failure,
	inspectCommand,
	liveKeymapCommand,
	passwordLines,
	planCommand,
	requestOf,
	saveSetupStep,
	toApply,
	toInspect,
	toPlan,
	type Request,
} from "../app/runner";
import { readKeymapFamilies } from "../app/keymaps";
import { readZonePlaces } from "../app/zones";
import type { TargetInfo } from "../domain/recsetup";
import {
	allAnswered,
	canLogIn,
	FIELDS,
	currentPage,
	isField,
	matching,
	NO_ANSWERS,
	options,
	PAGE_IDS,
	START_AT,
	waitsFor,
	type Answers,
	type FieldId,
	type PageId,
	type PickField,
	type Session,
	type Target,
} from "../domain/setup";

/** Why recsetup refused a typed answer, what it says to do, and which character of the
 * answer it is (a character's index in the typed text; null when no single character is). */
export type Refusal = { message: string; fix: string | null; at: number | null };

/** The question being asked. */
export type Prompt =
	/** A list, narrowed by what is typed; `index` is into the narrowed list. `trying` is
	 * what has been typed on the keyboard line while the layout is tried; null while the
	 * keys narrow the list. */
	| { kind: "pick"; field: PickField; filter: string; index: number; trying: string | null }
	/** A name; `checking` while recsetup is asked whether it will do. */
	| {
			kind: "text";
			field: "hostname" | "user";
			text: string;
			error: Refusal | null;
			checking: boolean;
	  }
	/** A password, typed twice; `first` holds the first entry while the second is typed.
	 * `name` is the account: root, or the user about to be created. */
	| {
			kind: "password";
			who: "root" | "user";
			name: string;
			first: string | null;
			text: string;
			error: string | null;
	  }
	/** On a desktop system, after the user's password: whether the user is logged in at
	 * every boot without asking. */
	| { kind: "autologin"; name: string; password: string }
	/** A yes before the plan's commands run. */
	| { kind: "apply" };

export type Setup = ReturnType<typeof useSetup>;

/** The hostname offered before one is typed: the distro's default. */
function defaultHostname(system: TargetInfo): string {
	return distroByOsId(system.os_id)?.defaultHostname ?? system.os_id;
}

/**
 * Which character of a refused name is the fault, asked of recsetup and not worked out
 * here: the first character whose replacement by a letter makes recsetup take the name.
 * Null when no one character does (several are wrong, or the name is too long).
 */
async function faultAt(
	target: string,
	field: "hostname" | "user",
	text: string,
): Promise<number | null> {
	const chars = [...text];
	if (chars.length > 64) return null;
	const accepted = await Promise.all(
		chars.map(async (char, i) => {
			if (char === "a") return false;
			const fixed = chars.map((c, j) => (j === i ? "a" : c)).join("");
			const result = await runCommand(planCommand(target, { [field]: fixed }));
			return result.exitCode === 0;
		}),
	);
	const at = accepted.indexOf(true);
	return at < 0 ? null : at;
}

export function useSetup(target: Target | null) {
	const [session, setSession] = useState<Session>({
		target,
		inspect: { kind: "idle" },
		answers: NO_ANSWERS,
		answered: {
			keymap: false,
			timezone: false,
			locale: false,
			hostname: false,
			root: false,
			user: false,
		},
		liveKeymap: { kind: "idle" },
		plan: { kind: "idle" },
		apply: { kind: "idle" },
		saved: null,
	});
	const [prompt, setPrompt] = useState<Prompt | null>(null);
	const [page, setPage] = useState<PageId>("overview");
	// A ref, not state: two keys handled in one batch must not both start a run.
	const busy = useRef(false);
	const update = (change: Partial<Session>) => setSession((s) => ({ ...s, ...change }));

	const guard = (run: () => Promise<void>) => {
		if (busy.current) return false;
		busy.current = true;
		void run().finally(() => {
			busy.current = false;
		});
		return true;
	};

	const inspect = () =>
		target !== null &&
		guard(async () => {
			const argv = inspectCommand(target.path);
			update({ inspect: { kind: "running", argv } });
			update({ inspect: toInspect(await runCommand(argv)) });
		});

	useEffect(() => void inspect(), []);

	const system = session.inspect.kind === "ok" ? session.inspect.value : null;
	// Where each zone is, for the map beside the time zone list.
	const root = system?.target.root;
	const places = useMemo(() => (root ? readZonePlaces(root) : new Map()), [root]);
	// Which family each keymap belongs to, for the keys on the keyboard card.
	const families = useMemo(() => (root ? readKeymapFamilies(root) : () => null), [root]);

	/** Asks `field`'s question, starting from its answer in `from` when it has one. */
	const open = (field: FieldId, from: Session = session) => {
		if (!system) return;
		if (field === "keymap" || field === "timezone" || field === "locale") {
			const at = options(field, system.choices).indexOf(from.answers[field] ?? START_AT[field]);
			return setPrompt({
				kind: "pick",
				field,
				filter: "",
				index: Math.max(0, at),
				trying: null,
			});
		}
		if (field === "root")
			return setPrompt({
				kind: "password",
				who: "root",
				name: "root",
				first: null,
				text: "",
				error: null,
			});
		setPrompt({
			kind: "text",
			field,
			text:
				field === "hostname"
					? (from.answers.hostname ?? defaultHostname(system.target))
					: (from.answers.user ?? ""),
			error: null,
			checking: false,
		});
	};

	/** Loads the chosen keymap on this console, so what is typed next matches it. */
	const loadLive = (keymap: string) => {
		const argv = liveKeymapCommand(keymap);
		update({ liveKeymap: { kind: "running", argv } });
		void runCommand(argv).then((result) =>
			update({
				liveKeymap:
					result.exitCode === 0
						? { kind: "ok", argv, value: keymap }
						: { kind: "failed", failure: failure(result) },
			}),
		);
	};

	/** Records `field`'s answer and goes to the next page, asking its question when it
	 * has no answer yet. An answer changed after a plan or an apply makes both stale. */
	const settle = (field: FieldId, change: Partial<Answers>) => {
		const next: Session = {
			...session,
			answers: { ...session.answers, ...change },
			answered: { ...session.answered, [field]: true },
		};
		setSession((s) => ({
			...s,
			answers: { ...s.answers, ...change },
			answered: { ...s.answered, [field]: true },
			plan: { kind: "idle" },
			apply: { kind: "idle" },
		}));
		// With everything answered (an answer changed from the review), back to the review.
		const after = allAnswered(next) ? "review" : PAGE_IDS[PAGE_IDS.indexOf(field) + 1]!;
		setPage(after);
		if (isField(after) && !next.answered[after]) open(after, next);
		else setPrompt(null);
	};

	/** Asks recsetup whether it would take `request` (one answer), by planning it. */
	const check = (
		request: Request,
		field: "hostname" | "user",
		text: string,
		lead: number,
		accepted: () => void,
	) =>
		target !== null &&
		guard(async () => {
			setPrompt((p) => (p?.kind === "text" ? { ...p, checking: true, error: null } : p));
			const plan = toPlan(await runCommand(planCommand(target.path, request)));
			if (plan.kind === "ok") return accepted();
			const refused = plan.kind === "failed" ? plan.failure : null;
			const message = refused?.error
				? { message: refused.error.message, fix: refused.error.remediation ?? null }
				: { message: refused?.output.split("\n")[0] || "recsetup refused it", fix: null };
			const at = await faultAt(target.path, field, text);
			const error: Refusal = { ...message, at: at === null ? null : at + lead };
			setPrompt((p) => (p?.kind === "text" ? { ...p, checking: false, error } : p));
		});

	const type = (text: string) =>
		setPrompt((p) => {
			if (!p || p.kind === "apply" || p.kind === "autologin") return p;
			if (p.kind === "pick") {
				if (p.trying !== null) return { ...p, trying: p.trying + text };
				return { ...p, filter: p.filter + text, index: 0 };
			}
			if (p.kind === "text") return p.checking ? p : { ...p, text: p.text + text, error: null };
			return { ...p, text: p.text + text, error: null };
		});

	const erase = () =>
		setPrompt((p) => {
			if (!p || p.kind === "apply" || p.kind === "autologin") return p;
			if (p.kind === "pick") {
				if (p.trying !== null) return { ...p, trying: p.trying.slice(0, -1) };
				return { ...p, filter: p.filter.slice(0, -1), index: 0 };
			}
			if (p.kind === "text" && p.checking) return p;
			return { ...p, text: p.text.slice(0, -1) };
		});

	/** Moves the list's selection by `by` rows. */
	const move = (by: number) => {
		if (prompt?.kind !== "pick" || !system) return;
		const list = matching(options(prompt.field, system.choices), prompt.filter);
		const index = Math.max(0, Math.min(list.length - 1, prompt.index + by));
		setPrompt({ ...prompt, index });
		// While a layout is tried, the one under the selection is the one on the console.
		const chosen = list[index];
		if (prompt.trying !== null && chosen !== undefined && chosen !== list[prompt.index])
			loadLive(chosen);
	};

	/** Tab on the keyboard list: moves to the line to try the layout on, loading the
	 * selected layout on this console, and back to the list. */
	const tryIt = () => {
		if (prompt?.kind !== "pick" || prompt.field !== "keymap" || !system) return;
		if (prompt.trying !== null) return setPrompt({ ...prompt, trying: null });
		const chosen = matching(options("keymap", system.choices), prompt.filter)[prompt.index];
		if (chosen === undefined) return;
		loadLive(chosen);
		setPrompt({ ...prompt, trying: "" });
	};

	/** Jumps to question `n` (1 to 6) and asks it. */
	const jump = (n: number) => {
		const field = FIELDS[n - 1];
		if (!field || !system) return;
		setPage(field);
		open(field);
	};

	const accept = () => {
		if (!prompt || !system || prompt.kind === "apply" || prompt.kind === "autologin") return;
		if (prompt.kind === "pick") {
			const chosen = matching(options(prompt.field, system.choices), prompt.filter)[prompt.index];
			if (chosen === undefined) return;
			if (prompt.field === "keymap") loadLive(chosen);
			return settle(prompt.field, { [prompt.field]: chosen });
		}
		if (prompt.kind === "text") {
			if (prompt.checking) return;
			const text = prompt.text.trim();
			// Where the trimmed text starts in what was typed.
			const lead = prompt.text.length - prompt.text.trimStart().length;
			if (prompt.field === "hostname") {
				if (!text)
					return setPrompt({
						...prompt,
						error: { message: "The machine needs a name.", fix: null, at: null },
					});
				return void check({ hostname: text }, "hostname", text, lead, () =>
					settle("hostname", { hostname: text }),
				);
			}
			// No name: no user.
			if (!text) return settle("user", { user: null, userPassword: null, autologin: false });
			return void check({ user: text }, "user", text, lead, () =>
				setPrompt({
					kind: "password",
					who: "user",
					name: text,
					first: null,
					text: "",
					error: null,
				}),
			);
		}
		if (prompt.first === null) {
			if (prompt.text === "") {
				// No password for root: only a user can administer the system.
				if (prompt.who === "root") return settle("root", { rootPassword: null });
				return setPrompt({ ...prompt, error: "A user needs a password to log in." });
			}
			return setPrompt({ ...prompt, first: prompt.text, text: "", error: null });
		}
		if (prompt.text !== prompt.first)
			return setPrompt({
				...prompt,
				first: null,
				text: "",
				error: "The two don't match. Type it again.",
			});
		if (prompt.who === "root") return settle("root", { rootPassword: prompt.first });
		if (system.target.flavour === "desktop")
			return setPrompt({ kind: "autologin", name: prompt.name, password: prompt.first });
		settle("user", { user: prompt.name, userPassword: prompt.first, autologin: false });
	};

	/** The answer to the autologin question: off unless the user says yes. */
	const answerAutologin = (yes: boolean) => {
		if (prompt?.kind !== "autologin") return;
		settle("user", { user: prompt.name, userPassword: prompt.password, autologin: yes });
	};

	const fetchPlan = () =>
		target !== null &&
		guard(async () => {
			const argv = planCommand(target.path, requestOf(session.answers));
			update({ plan: { kind: "running", argv } });
			update({ plan: toPlan(await runCommand(argv)) });
		});

	// The review page shows recsetup's plan for the answers as they stand.
	const planKey =
		page === "review" &&
		allAnswered(session) &&
		session.plan.kind === "idle" &&
		session.apply.kind === "idle"
			? JSON.stringify(requestOf(session.answers))
			: null;
	useEffect(() => {
		if (planKey) fetchPlan();
	}, [planKey]);

	/** Enter on the review page: asks for the yes; says why not when it can't. */
	const beginApply = (): string | null => {
		if (busy.current) return "wait for the running step to finish";
		const waiting = waitsFor(session, "review");
		if (waiting) return `waits for ${waiting}`;
		if (!canLogIn(session.answers))
			return "nobody could log in: set a root password or create a user first";
		if (session.plan.kind !== "ok") {
			fetchPlan();
			return null;
		}
		setPrompt({ kind: "apply" });
		return null;
	};

	const confirmApply = () =>
		target !== null &&
		guard(async () => {
			setPrompt(null);
			const { answers } = session;
			const argv = applyCommand(target.path, requestOf(answers));
			update({ apply: { kind: "running", argv } });
			// The passwords go to recsetup's stdin, never into its arguments.
			const apply = toApply(await runCommand(argv, { stdin: passwordLines(answers) }));
			const saved =
				apply.kind === "ok"
					? saveSetupStep({ manual: false, hostname: answers.hostname, user: answers.user })
					: null;
			setSession((s) => ({ ...s, apply, saved: saved ?? s.saved }));
			if (saved) setPage("done");
		});

	/** Goes to the page the step is at, asking its question when it is one. */
	const resume = () => {
		const at = currentPage(session);
		setPage(at);
		if (isField(at)) open(at);
	};

	const running =
		session.inspect.kind === "running" ||
		session.plan.kind === "running" ||
		session.apply.kind === "running" ||
		(prompt?.kind === "text" && prompt.checking);

	return {
		session,
		system,
		places,
		prompt,
		page,
		running,
		go: (next: PageId) => {
			setPage(next);
			setPrompt(null);
		},
		inspect,
		open,
		resume,
		type,
		erase,
		move,
		accept,
		answerAutologin,
		cancel: () => setPrompt(null),
		tryIt,
		jump,
		families,
		fetchPlan,
		beginApply,
		confirmApply,
	};
}
