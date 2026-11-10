/** The screen's state: the system, the answers, the question being asked, and the runs. */
import { useEffect, useRef, useState } from "react";
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
import type { TargetInfo } from "../domain/recsetup";
import {
	allAnswered,
	canLogIn,
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

/** Why recsetup refused a typed answer, and what it says to do. */
export type Refusal = { message: string; fix: string | null };

/** The question being asked. */
export type Prompt =
	/** A list, narrowed by what is typed; `index` is into the narrowed list. */
	| { kind: "pick"; field: PickField; filter: string; index: number }
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
	/** A yes before the plan's commands run. */
	| { kind: "apply" };

export type Setup = ReturnType<typeof useSetup>;

/** The hostname offered before one is typed: the distro's default. */
function defaultHostname(system: TargetInfo): string {
	return distroByOsId(system.os_id)?.defaultHostname ?? system.os_id;
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

	/** Asks `field`'s question, starting from its answer in `from` when it has one. */
	const open = (field: FieldId, from: Session = session) => {
		if (!system) return;
		if (field === "keymap" || field === "timezone" || field === "locale") {
			const at = options(field, system.choices).indexOf(from.answers[field] ?? START_AT[field]);
			return setPrompt({ kind: "pick", field, filter: "", index: Math.max(0, at) });
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
		const after = PAGE_IDS[PAGE_IDS.indexOf(field) + 1]!;
		setPage(after);
		if (isField(after) && !next.answered[after]) open(after, next);
		else setPrompt(null);
	};

	/** Asks recsetup whether it would take `request` (one answer), by planning it. */
	const check = (request: Request, accepted: () => void) =>
		target !== null &&
		guard(async () => {
			setPrompt((p) => (p?.kind === "text" ? { ...p, checking: true, error: null } : p));
			const plan = toPlan(await runCommand(planCommand(target.path, request)));
			if (plan.kind === "ok") return accepted();
			const refused = plan.kind === "failed" ? plan.failure : null;
			const error: Refusal = refused?.error
				? { message: refused.error.message, fix: refused.error.remediation ?? null }
				: { message: refused?.output.split("\n")[0] || "recsetup refused it", fix: null };
			setPrompt((p) => (p?.kind === "text" ? { ...p, checking: false, error } : p));
		});

	const type = (text: string) =>
		setPrompt((p) => {
			if (!p || p.kind === "apply") return p;
			if (p.kind === "pick") return { ...p, filter: p.filter + text, index: 0 };
			if (p.kind === "text") return p.checking ? p : { ...p, text: p.text + text, error: null };
			return { ...p, text: p.text + text, error: null };
		});

	const erase = () =>
		setPrompt((p) => {
			if (!p || p.kind === "apply") return p;
			if (p.kind === "pick") return { ...p, filter: p.filter.slice(0, -1), index: 0 };
			if (p.kind === "text" && p.checking) return p;
			return { ...p, text: p.text.slice(0, -1) };
		});

	/** Moves the list's selection by `by` rows. */
	const move = (by: number) => {
		if (prompt?.kind !== "pick" || !system) return;
		const count = matching(options(prompt.field, system.choices), prompt.filter).length;
		setPrompt({ ...prompt, index: Math.max(0, Math.min(count - 1, prompt.index + by)) });
	};

	const accept = () => {
		if (!prompt || !system || prompt.kind === "apply") return;
		if (prompt.kind === "pick") {
			const chosen = matching(options(prompt.field, system.choices), prompt.filter)[prompt.index];
			if (chosen === undefined) return;
			if (prompt.field === "keymap") loadLive(chosen);
			return settle(prompt.field, { [prompt.field]: chosen });
		}
		if (prompt.kind === "text") {
			if (prompt.checking) return;
			const text = prompt.text.trim();
			if (prompt.field === "hostname") {
				if (!text)
					return setPrompt({
						...prompt,
						error: { message: "The machine needs a name.", fix: null },
					});
				return void check({ hostname: text }, () => settle("hostname", { hostname: text }));
			}
			// No name: no user.
			if (!text) return settle("user", { user: null, userPassword: null });
			return void check({ user: text }, () =>
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
		settle("user", { user: prompt.name, userPassword: prompt.first });
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
		cancel: () => setPrompt(null),
		fetchPlan,
		beginApply,
		confirmApply,
	};
}
