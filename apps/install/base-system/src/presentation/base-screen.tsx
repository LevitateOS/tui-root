import { Box, useApp } from "ink";
import { useEffect, useState, type ReactNode } from "react";
import {
	AppShell,
	ContentWidth,
	fitFooter,
	keymapStatusSegments,
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
import { formatCount } from "@levitate/tui-kit";
import {
	currentPage,
	PAGE_IDS,
	PAGES,
	STEP_PAGES,
	pageState,
	waitsFor,
	type PageId,
	type Session,
	type Target,
} from "../domain/base";
import { CONFIRM_KEYS, MAIN_KEYS } from "./keymap";
import { CheckPage, CopyPage, DonePage, FstabPage, OverviewPage, pageAction } from "./pages";
import { useBase } from "./use-base";
import type { Then } from "@levitate/install-state";

export function BaseScreen({
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
		action: true,
	});
	const base = useBase(target);
	const { session, prompt } = base;
	const [page, setPage] = useState<PageId>("overview");
	const [notice, setNotice] = useState<string | null>(null);
	const go = (next: PageId) => {
		setPage(next);
		setNotice(null);
	};

	// Once the step is recorded, the Done page says so.
	useEffect(() => {
		if (session.saved) go("done");
	}, [session.saved]);

	const busyNotice = () => setNotice("wait for the running step to finish");
	const enter = () => {
		setNotice(null);
		if (page === "overview")
			return target ? go(currentPage(session)) : setNotice(waitsFor(session, "check"));
		if (base.running) return busyNotice();
		const waiting = waitsFor(session, page);
		if (page === "check") {
			if (session.check.kind === "ok") return go("copy");
			return void base.check();
		}
		if (page === "copy") {
			if (waiting) return setNotice(`waits for ${waiting}`);
			if (session.copy.kind === "ok") return go("fstab");
			if (session.copy.kind === "failed") {
				go("check");
				return void base.check();
			}
			return void base.copy();
		}
		if (page === "fstab") {
			if (waiting) return setNotice(`waits for ${waiting}`);
			if (session.write.kind === "ok") return go("done");
			if (session.fstab.kind !== "ok") return void base.readFstab();
			return setNotice(base.write());
		}
		if (session.saved) return exit();
		setNotice(`waits for ${waiting ?? "the fstab"}`);
	};

	useKeymap(
		MAIN_KEYS,
		{
			move: (key) => {
				const step = key === "up" || key === "k" ? -1 : 1;
				go(PAGE_IDS[Math.min(PAGE_IDS.length - 1, Math.max(0, PAGE_IDS.indexOf(page) + step))]!);
			},
			go: enter,
			again: () => {
				if (base.running) return busyNotice();
				if (page === "check") return void base.check();
				if (page === "fstab" && session.copy.kind === "ok") return void base.readFstab();
				setNotice("r works on the Check and fstab pages");
			},
			quit: () =>
				base.copying
					? setNotice("the copy can't be stopped half-way; wait for it to finish")
					: exit(),
		},
		{ active: !prompt },
	);
	useKeymap(
		CONFIRM_KEYS,
		{ yes: () => void base.confirmReplace(), no: base.cancel },
		{ active: prompt !== null },
	);

	const keys = prompt ? CONFIRM_KEYS : MAIN_KEYS;
	const pageHeight = usePageHeight(page);
	const scrollable = !prompt && pageHeight.height > shell.content.textRows - 2;
	const layout = fitFooter(shell, [
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning")] : []),
		// What is running, else the target, at the line's end.
		base.running
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
		) : page === "check" ? (
			<CheckPage session={session} />
		) : page === "copy" ? (
			<CopyPage session={session} now={base.now} />
		) : page === "fstab" ? (
			<FstabPage session={session} prompt={prompt} />
		) : (
			<DonePage session={session} />
		);
	return (
		<ContentWidth.Provider value={layout.content.textColumns}>
			<AppShell
				layout={layout}
				focus="navigation"
				navTitle="Base system"
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
				action={pageAction(session, page, prompt, then)}
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
	if (session.check.kind === "running") return "checking the target";
	if (session.copy.kind === "running") return "copying the system";
	if (session.write.kind === "running") return "writing the fstab";
	return "reading the mounts";
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

/** What a finished step left, short enough for the end of its row on the path. */
function pathValue(session: Session, id: PageId): string {
	const { check, copy, write } = session;
	if (id === "check" && check.kind === "ok") return `${check.value.checks} passed`;
	if (id === "copy" && copy.kind === "ok") return `${formatCount(copy.done.entries)} files`;
	if (id === "fstab" && write.kind === "ok") return `${write.value.entries.length} entries`;
	return "";
}

/** Every page as a step on the path, with how far it has got and what it left. */
function pathSteps(session: Session): PathStep[] {
	return PAGE_IDS.map((id) => ({
		id,
		label: PAGES[id].short,
		state: pageState(session, id),
		value: pathValue(session, id),
	}));
}
