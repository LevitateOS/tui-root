import { Box, Text, useApp } from "ink";
import { useState, type ReactNode } from "react";
import {
	AppShell,
	ContentWidth,
	fitFooter,
	keymapStatusSegments,
	movesBack,
	PAGE_SCROLL_KEYS,
	textStatusSegment,
	textWidth,
	truncateLine,
	useIntentColor,
	useKeymap,
	usePageHeight,
	usePageScroll,
	useShellLayout,
	useTuiViewport,
	type ColorIntent,
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
	type PageState,
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
	const shell = useShellLayout({ navWidth: columns < 110 ? 26 : 32 });
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
	const listRows = Math.max(4, shell.content.textRows - 12);
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
		setup.running
			? textStatusSegment("busy", runningLabel(session), "warning")
			: textStatusSegment("busy", target ? target.path : "no target", target ? "accent" : "error"),
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning", true)] : []),
	]);
	const scroll = usePageScroll(pageHeight, layout.content.textRows, prompt === null);

	const content =
		page === "overview" ? (
			<OverviewPage session={session} stateError={stateError} />
		) : isField(page) ? (
			<FieldPage field={page} session={session} prompt={prompt} listRows={listRows} />
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
					<Rail session={session} page={page} width={(layout.nav ?? layout.content).textColumns} />
				}
				contentTitle={`${PAGES[page].title}${scroll.more}`}
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

const MARK: Record<PageState, { mark: string; intent: ColorIntent }> = {
	done: { mark: "✓", intent: "success" },
	running: { mark: "◐", intent: "warning" },
	failed: { mark: "✗", intent: "error" },
	ready: { mark: "●", intent: "accent" },
	waiting: { mark: "○", intent: "dimText" },
};

/** The rail's name for a page: the steps numbered in order. */
function railLabel(id: PageId): string {
	const step = (STEP_PAGES as readonly PageId[]).indexOf(id);
	return step < 0 ? PAGES[id].short : `${step + 1} ${PAGES[id].short}`;
}

/** The legend under the rail, two marks a line, from the marks themselves. */
const LEGEND = Object.entries(MARK)
	.map(([state, { mark }]) => `${mark} ${state}`)
	.reduce<string[]>((lines, entry, i) => {
		if (i % 2 === 0) lines.push(entry);
		else lines[lines.length - 1] += ` ${entry}`;
		return lines;
	}, []);

/** The questions in order, each with how far it has got. */
function Rail({
	session,
	page,
	width,
}: {
	session: Session;
	page: PageId;
	width: number;
}): ReactNode {
	const color = useIntentColor();
	const item = (id: PageId) => {
		const selected = id === page;
		const { mark, intent } = MARK[pageState(session, id)];
		const text = truncateLine(railLabel(id), Math.max(1, width - 5));
		return (
			<Text key={id}>
				<Text color={color("accent")}>{selected ? "▸ " : "  "}</Text>
				<Text color={color(intent)}>{mark}</Text>
				<Text bold={selected} color={color(selected ? "accent" : "navItem")}>
					{` ${text}`}
				</Text>
				<Text>{" ".repeat(Math.max(0, width - 4 - textWidth(text)))}</Text>
			</Text>
		);
	};
	return (
		<Box flexDirection="column">
			{item("overview")}
			<Box marginTop={1}>
				<Text bold color={color("navHeading")}>
					STEPS
				</Text>
			</Box>
			{STEP_PAGES.map(item)}
			<Box marginTop={1}>{item("done")}</Box>
			<Box marginTop={1} flexDirection="column">
				{LEGEND.map((line) => (
					<Text key={line} color={color("dimText")}>
						{line}
					</Text>
				))}
			</Box>
		</Box>
	);
}
