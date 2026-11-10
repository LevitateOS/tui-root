import { Box, useApp } from "ink";
import { useState, type ReactNode } from "react";
import {
	AppShell,
	ContentWidth,
	fitFooter,
	HEADING_ROWS,
	keymapStatusSegments,
	movesBack,
	PAGE_SCROLL_KEYS,
	StepPath,
	textStatusSegment,
	useKeymap,
	usePageHeight,
	usePageScroll,
	useShellLayout,
	useTuiViewport,
	type PageAction,
	type PageNote,
	type PathStep,
	type Progress,
} from "@levitate/tui-kit";
import type { Then } from "@levitate/install-state";
import { guideTitle, STEP_INFO } from "@levitate/docs-content/install";
import {
	canLogIn,
	FIELDS,
	firstUnanswered,
	isField,
	PAGE_IDS,
	PAGES,
	STEP_PAGES,
	pageState,
	waitsFor,
	type PageId,
	type Session,
	type Target,
} from "../domain/setup";
import {
	AGAIN_KEYS,
	CONFIRM_KEYS,
	KEYBOARD_KEYS,
	MAIN_KEYS,
	PAGE_KEYS,
	PICK_KEYS,
	reviewKeys,
	TEXT_KEYS,
} from "./keymap";
import {
	COLUMN_ROWS,
	DonePage,
	FieldPage,
	OverviewPage,
	ReviewPage,
	type ReviewView,
} from "./pages";
import { useSetup } from "./use-setup";

export function SetupScreen({
	target,
	stateError,
	then,
}: {
	target: Target | null;
	stateError: string | null;
	then: Then;
}): ReactNode {
	const { exit } = useApp();
	const { columns } = useTuiViewport();
	const shell = useShellLayout({
		navWidth: columns < 90 ? 26 : 28,
		navFlush: true,
		steps: true,
		action: true,
	});
	const setup = useSetup(target);
	const { session, prompt, page } = setup;
	const [notice, setNotice] = useState<string | null>(null);
	// The review page shows the answers as a card, or turned over, the commands.
	const [view, setView] = useState<ReviewView>("answers");
	const go = (next: PageId) => {
		setup.go(next);
		setNotice(null);
	};

	const busyNotice = () => setNotice("wait for the running step to finish");
	const enter = () => {
		setNotice(null);
		if (page === "overview") {
			if (!target) return setNotice(waitsFor(session, "overview"));
			if (session.inspect.kind === "failed") return void setup.inspect();
			if (session.inspect.kind !== "ok") return busyNotice();
			return setup.resume();
		}
		if (isField(page)) {
			const waiting = waitsFor(session, page);
			return waiting ? setNotice(`waits for ${waiting}`) : setup.open(page);
		}
		if (page === "review") {
			if (session.apply.kind === "ok") return go("done");
			return setNotice(setup.beginApply());
		}
		if (session.saved) return exit();
		setNotice(`waits for ${waitsFor(session, "done") ?? "the configuration to be applied"}`);
	};

	const reviewing = page === "review" && !prompt && waitsFor(session, "review") === null;
	// The yes-or-no is at the top of the review page: asking it scrolls back up to it.
	const pageHeight = usePageHeight(
		`${prompt?.kind === "apply" ? `${page}?` : page}${page === "review" ? view : ""}`,
	);
	const keys =
		prompt === null
			? reviewing && session.apply.kind === "idle"
				? reviewKeys(view === "answers" ? "the commands" : "the answers")
				: MAIN_KEYS
			: prompt.kind === "pick"
				? prompt.field === "keymap"
					? KEYBOARD_KEYS
					: PICK_KEYS
				: prompt.kind === "apply"
					? CONFIRM_KEYS
					: TEXT_KEYS;
	const scrollable = !prompt && pageHeight.height > shell.content.textRows;
	const layout = fitFooter(shell, [
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning", true)] : []),
		// What is running, else how the apply stands, else the system being configured,
		// at the line's end.
		setup.running
			? textStatusSegment("busy", runningLabel(session), "warning", false, true)
			: textStatusSegment(
					"busy",
					session.apply.kind === "failed" ? "stopped" : target ? target.path : "no target",
					target ? "faintText" : "error",
					false,
					true,
				),
	]);
	const scroll = usePageScroll(pageHeight, layout.content.textRows, prompt === null);
	// A question's list and card are this tall, and the list shows two rows fewer.
	const columnRows = Math.max(6, Math.min(COLUMN_ROWS, layout.content.textRows - HEADING_ROWS));
	const listRows = columnRows - 2;

	useKeymap(
		MAIN_KEYS,
		{
			move: (key) => {
				const step = movesBack(MAIN_KEYS, key) ? -1 : 1;
				go(PAGE_IDS[Math.min(PAGE_IDS.length - 1, Math.max(0, PAGE_IDS.indexOf(page) + step))]!);
			},
			go: enter,
			quit: () =>
				session.apply.kind === "running"
					? setNotice("the configuration is being applied; wait for it to finish")
					: exit(),
		},
		{ active: !prompt },
	);
	useKeymap(
		AGAIN_KEYS,
		{
			again: () => {
				if (setup.running) return busyNotice();
				if (page === "review" && session.apply.kind !== "ok") return void setup.fetchPlan();
				if (session.inspect.kind !== "ok") return void setup.inspect();
				setNotice("the system is read; r reads the plan again on the Apply page");
			},
		},
		{ active: !prompt },
	);
	useKeymap(
		reviewKeys(""),
		{
			pick: (key) => setup.jump(Number(key)),
			turn: () => setView((v) => (v === "answers" ? "commands" : "answers")),
		},
		{ active: reviewing },
	);
	useKeymap(
		PICK_KEYS,
		{
			move: (key) => setup.move(movesBack(PICK_KEYS, key) ? -1 : 1),
			accept: setup.accept,
			erase: setup.erase,
			cancel: setup.cancel,
		},
		{ active: prompt?.kind === "pick", onText: setup.type },
	);
	useKeymap(
		PAGE_KEYS,
		{ page: (key) => setup.move(movesBack(PAGE_KEYS, key) ? -listRows : listRows) },
		{ active: prompt?.kind === "pick" },
	);
	useKeymap(KEYBOARD_KEYS, { try: setup.tryIt }, { active: prompt?.kind === "pick" });
	useKeymap(
		TEXT_KEYS,
		{ accept: setup.accept, erase: setup.erase, cancel: setup.cancel },
		{ active: prompt?.kind === "text" || prompt?.kind === "password", onText: setup.type },
	);
	useKeymap(
		CONFIRM_KEYS,
		{ yes: () => void setup.confirmApply(), no: setup.cancel },
		{ active: prompt?.kind === "apply" },
	);

	const content =
		page === "overview" ? (
			<OverviewPage session={session} stateError={stateError} />
		) : isField(page) ? (
			<FieldPage
				field={page}
				session={session}
				prompt={prompt}
				height={columnRows}
				places={setup.places}
				families={setup.families}
			/>
		) : page === "review" ? (
			<ReviewPage session={session} prompt={prompt} view={view} />
		) : (
			<DonePage session={session} />
		);
	return (
		<ContentWidth.Provider value={layout.content.textColumns}>
			<AppShell
				layout={layout}
				focus="navigation"
				navTitle="Configuration"
				nav={
					<StepPath
						steps={pathSteps(session)}
						selected={page}
						width={(layout.nav ?? layout.content).textColumns}
						rows={(layout.nav ?? layout.content).textRows}
					/>
				}
				contentTitle={`${place(page)}${scroll.more}`}
				progress={progress(session, page)}
				action={actionOf(session, page, prompt !== null, target, then)}
				content={
					<Box
						ref={pageHeight.ref}
						flexDirection="column"
						flexShrink={0}
						marginTop={-scroll.offset}
					>
						{content}
					</Box>
				}
			/>
		</ContentWidth.Provider>
	);
}

/** The page's one thing to press, or its one quiet line: none while a question is open. */
function actionOf(
	session: Session,
	page: PageId,
	asking: boolean,
	target: Target | null,
	then: Then,
): PageAction | PageNote | undefined {
	const { inspect, apply, plan, answered } = session;
	if (asking || !target) return undefined;
	if (page === "overview") {
		if (inspect.kind === "failed") return { label: "Read it again", key: "Enter" };
		if (inspect.kind !== "ok")
			return { note: `Reading the system at ${target.path}…`, intent: "warning" };
		const next = firstUnanswered(session);
		if (next === null) return { label: "Review the answers", key: "Enter" };
		const none = FIELDS.every((field) => !answered[field]);
		return {
			label: none
				? `Start with the ${PAGES[next].short.toLowerCase()}`
				: `Go on with the ${PAGES[next].short.toLowerCase()}`,
			key: "Enter",
		};
	}
	if (isField(page)) {
		if (inspect.kind !== "ok") return undefined;
		return { label: answered[page] ? "Change the answer" : "Answer the question", key: "Enter" };
	}
	if (page === "review") {
		if (waitsFor(session, "review")) return undefined;
		if (apply.kind === "running")
			return { note: `Applying the configuration to ${target.path}…`, intent: "warning" };
		if (apply.kind === "failed") return { label: "Apply again", key: "Enter" };
		if (apply.kind === "ok") return { label: "Go on", key: "Enter" };
		if (plan.kind === "running") return { note: "Working out the commands…", intent: "warning" };
		if (plan.kind === "ok" && canLogIn(session.answers))
			return { label: `Apply to ${target.path}`, key: "Enter" };
		return undefined;
	}
	if (session.saved?.kind === "ok" || session.saved?.kind === "failed") {
		return then === "hub"
			? { label: `Make it ${STEP_INFO.boot.title.toLowerCase()}`, key: "Enter" }
			: { note: `Next: ${guideTitle("installation-boot")}.` };
	}
	return undefined;
}

function runningLabel(session: Session): string {
	if (session.apply.kind === "running") return "applying the configuration";
	if (session.plan.kind === "running") return "working out the commands";
	if (session.inspect.kind === "running") return "reading the system";
	return "asking recsetup";
}

/** Where the page is, after the app's name in the band. */
function place(id: PageId): string {
	const step = (STEP_PAGES as readonly PageId[]).indexOf(id);
	return step < 0 ? PAGES[id].title : `step ${step + 1} of ${STEP_PAGES.length}`;
}

/** The line under the band: a segment a step, filled as far as they are done in order. */
function progress(session: Session, page: PageId): Progress {
	const firstOpen = STEP_PAGES.findIndex((id) => pageState(session, id) !== "done");
	const current = (STEP_PAGES as readonly PageId[]).indexOf(page);
	return {
		total: STEP_PAGES.length,
		done: firstOpen < 0 ? STEP_PAGES.length : firstOpen,
		current: current < 0 ? undefined : current,
	};
}

/** An answer as the path shows it beside its step: short, a password only as set or not. */
function pathValue(session: Session, id: PageId): string {
	if (id === "review")
		return session.apply.kind === "ok" ? `${session.apply.value.steps.length} steps` : "";
	if (!isField(id) || !session.answered[id]) return "";
	const { answers } = session;
	switch (id) {
		case "timezone":
			return answers.timezone?.split("/").at(-1)?.replace(/_/g, " ") ?? "";
		case "locale":
			return answers.locale?.split(".")[0] ?? "";
		case "root":
			return answers.rootPassword === null ? "none" : "set";
		case "user":
			return answers.user ?? "none";
		default:
			return answers[id] ?? "";
	}
}

/** Every page as a step on the path, with how far it has got and its answer. */
function pathSteps(session: Session): PathStep[] {
	return PAGE_IDS.map((id) => ({
		id,
		label: PAGES[id].short,
		state: pageState(session, id),
		value: pathValue(session, id),
	}));
}
