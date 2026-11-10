import { Box, useApp } from "ink";
import { useState, type ReactNode } from "react";
import {
	AppShell,
	ContentWidth,
	fitFooter,
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
	type PathStep,
	type Progress,
} from "@levitate/tui-kit";
import type { Then } from "@levitate/install-state";
import {
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
import { CONFIRM_KEYS, MAIN_KEYS, PICK_KEYS, TEXT_KEYS } from "./keymap";
import { DonePage, FieldPage, OverviewPage, ReviewPage } from "./pages";
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
		navWidth: columns < 110 ? 26 : 32,
		navFlush: true,
		steps: true,
	});
	const setup = useSetup(target);
	const { session, prompt, page } = setup;
	const [notice, setNotice] = useState<string | null>(null);
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

	useKeymap(
		MAIN_KEYS,
		{
			move: (key) => {
				const step = movesBack(MAIN_KEYS, key) ? -1 : 1;
				go(PAGE_IDS[Math.min(PAGE_IDS.length - 1, Math.max(0, PAGE_IDS.indexOf(page) + step))]!);
			},
			go: enter,
			again: () => {
				if (setup.running) return busyNotice();
				if (page === "review" && session.apply.kind !== "ok") return void setup.fetchPlan();
				if (session.inspect.kind !== "ok") return void setup.inspect();
				setNotice("the system is read; r reads the plan again on the Apply page");
			},
			quit: () =>
				session.apply.kind === "running"
					? setNotice("the configuration is being applied; wait for it to finish")
					: exit(),
		},
		{ active: !prompt },
	);

	// The yes-or-no is at the top of the review page: asking it scrolls back up to it.
	const pageHeight = usePageHeight(prompt?.kind === "apply" ? `${page}?` : page);
	// What the footer and the frame take leaves this many rows for a list.
	const listRows = Math.max(4, shell.content.textRows - 7);
	useKeymap(
		PICK_KEYS,
		{
			move: (key) => setup.move(movesBack(PICK_KEYS, key) ? -1 : 1),
			page: (key) => setup.move(movesBack(PICK_KEYS, key) ? -listRows : listRows),
			accept: setup.accept,
			erase: setup.erase,
			cancel: setup.cancel,
		},
		{ active: prompt?.kind === "pick", onText: setup.type },
	);
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

	const keys = !prompt
		? MAIN_KEYS
		: prompt.kind === "pick"
			? PICK_KEYS
			: prompt.kind === "apply"
				? CONFIRM_KEYS
				: TEXT_KEYS;
	const scrollable = !prompt && pageHeight.height > shell.content.textRows - 2;
	const layout = fitFooter(shell, [
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning", true)] : []),
		// What is running, else the system being configured, at the line's end.
		setup.running
			? textStatusSegment("busy", runningLabel(session), "warning", false, true)
			: textStatusSegment(
					"busy",
					target ? target.path : "no target",
					target ? "navHeading" : "error",
					false,
					true,
				),
	]);
	const scroll = usePageScroll(pageHeight, layout.content.textRows, prompt === null);

	const content =
		page === "overview" ? (
			<OverviewPage session={session} stateError={stateError} />
		) : isField(page) ? (
			<FieldPage
				field={page}
				session={session}
				prompt={prompt}
				listRows={listRows}
				places={setup.places}
			/>
		) : page === "review" ? (
			<ReviewPage session={session} prompt={prompt} />
		) : (
			<DonePage session={session} then={then} />
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
