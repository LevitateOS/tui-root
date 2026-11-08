import { Box, Text, useApp } from "ink";
import { useEffect, useState, type ReactNode } from "react";
import {
	AppShell,
	ContentWidth,
	fitFooter,
	keymapStatusSegments,
	PAGE_SCROLL_KEYS,
	resolveIntentColor,
	textStatusSegment,
	textWidth,
	truncateLine,
	useKeymap,
	usePageHeight,
	usePageScroll,
	useShellLayout,
	useTuiColors,
	useTuiTheme,
	useTuiViewport,
	type ColorIntent,
} from "@levitate/tui-kit";
import {
	currentPage,
	PAGE_IDS,
	PAGE_TITLE,
	pageState,
	waitsFor,
	type PageId,
	type PageState,
	type Session,
	type Target,
} from "../domain/base";
import { CONFIRM_KEYS, MAIN_KEYS } from "./keymap";
import { CheckPage, CopyPage, DonePage, FstabPage, OverviewPage } from "./pages";
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
	const shell = useShellLayout({ navWidth: columns < 110 ? 26 : 32 });
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
		base.running
			? textStatusSegment("busy", runningLabel(session), "warning")
			: textStatusSegment("busy", target ? target.path : "no target", target ? "accent" : "error"),
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning", true)] : []),
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
			<DonePage session={session} then={then} />
		);
	return (
		<ContentWidth.Provider value={layout.content.textColumns}>
			<AppShell
				layout={layout}
				focus="navigation"
				navTitle="Base system"
				nav={
					<Rail session={session} page={page} width={(layout.nav ?? layout.content).textColumns} />
				}
				contentTitle={`${PAGE_TITLE[page]}${scroll.more}`}
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

const MARK: Record<PageState, { mark: string; intent: ColorIntent }> = {
	done: { mark: "✓", intent: "success" },
	running: { mark: "◐", intent: "warning" },
	failed: { mark: "✗", intent: "error" },
	ready: { mark: "●", intent: "accent" },
	waiting: { mark: "○", intent: "dimText" },
};

const RAIL_LABEL: Record<PageId, string> = {
	overview: "Overview",
	check: "1 Check",
	copy: "2 Copy",
	fstab: "3 fstab",
	done: "Done",
};

/** The steps in order, each with how far it has got. */
function Rail({
	session,
	page,
	width,
}: {
	session: Session;
	page: PageId;
	width: number;
}): ReactNode {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const color = (intent: ColorIntent) => resolveIntentColor(theme, intent, colors);
	const item = (id: PageId) => {
		const selected = id === page;
		const { mark, intent } = MARK[pageState(session, id)];
		const text = truncateLine(RAIL_LABEL[id], Math.max(1, width - 5));
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
			{item("check")}
			{item("copy")}
			{item("fstab")}
			<Box marginTop={1}>{item("done")}</Box>
			<Box marginTop={1} flexDirection="column">
				<Text color={color("dimText")}>✓ done ◐ running</Text>
				<Text color={color("dimText")}>● ready ○ waiting</Text>
				<Text color={color("dimText")}>✗ failed</Text>
			</Box>
		</Box>
	);
}
