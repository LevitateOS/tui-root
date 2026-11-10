import { Box, useApp } from "ink";
import { useState, type ReactNode } from "react";
import { dirname } from "node:path";
import {
	AppShell,
	ContentWidth,
	fitFooter,
	keymapStatusSegments,
	movesBack,
	PAGE_SCROLL_KEYS,
	StepPath,
	textStatusSegment,
	useFocusPlane,
	useHandOff,
	useKeymap,
	usePageHeight,
	usePageScroll,
	useShellLayout,
	useTuiViewport,
	type PathState,
	type PathStep,
} from "@levitate/tui-kit";
import { statePath } from "@levitate/install-state";
import type { Distro } from "@levitate/docs-content/distros";
import { exists, loadState, record, SHELL_ACTION, type Live } from "../app/handoff";
import { installSteps, railValue, type Action, type Step, type StepStatus } from "../domain/steps";
import { HUB_KEYS } from "./keymap";
import { pageAction, StepPage } from "./pages";

/** How each step stands on the rail; the step you are at is drawn ◉ by the rail itself. */
function railState(step: Step): PathState {
	const failed = step.checks?.some((check) => !check.ok) ?? false;
	const state: Record<StepStatus, PathState> = {
		done: "done",
		current: failed ? "failed" : "ready",
		blocked: "waiting",
	};
	return state[step.status];
}

export function HubScreen({
	distro,
	live,
	notice: carried,
}: {
	distro: Distro;
	live: Live;
	/** What went wrong while the hub was away (a step app that failed), if anything. */
	notice: string | null;
}): ReactNode {
	const { exit } = useApp();
	const handOff = useHandOff<Action>();
	const [loaded, setLoaded] = useState(loadState);
	const [notice, setNotice] = useState<string | null>(() => carried ?? loaded.error);
	// An unusable state file stops every step: doing one would build on an unknown install.
	const steps = installSteps(distro, loaded.state, (path) => exists(live, path)).map((step) =>
		loaded.error
			? {
					...step,
					status: "blocked" as const,
					action: { kind: "none" as const, why: loaded.error },
				}
			: step,
	);
	const [selected, setSelected] = useState(() =>
		Math.max(
			0,
			steps.findIndex((step) => step.status === "current"),
		),
	);
	const focus = useFocusPlane({ initial: "content" });
	const step = steps[selected]!;
	const reload = (error: string | null) => {
		setLoaded(loadState());
		setNotice(error);
	};

	useKeymap(HUB_KEYS, {
		move: (key) =>
			setSelected((i) =>
				movesBack(HUB_KEYS, key) ? Math.max(0, i - 1) : Math.min(steps.length - 1, i + 1),
			),
		start: () => {
			if (loaded.error) return setNotice(loaded.error);
			if (step.status === "blocked") {
				const current = steps.find((s) => s.status === "current");
				return setNotice(`first: ${current?.title ?? "the step before"}`);
			}
			const action = step.action;
			if (action.kind === "none") return setNotice(action.why);
			if (action.kind === "record") {
				reload(record(action.record));
				return setSelected((i) => Math.min(steps.length - 1, i + 1));
			}
			handOff(action);
		},
		mark: () => {
			const action = step.action;
			if (action.kind !== "app" || !action.byHand) {
				return setNotice(`${step.title} is marked done by doing it`);
			}
			if (step.status === "blocked") return setNotice("finish the steps before it first");
			reload(record(action.byHand));
			setSelected((i) => Math.min(steps.length - 1, i + 1));
		},
		shell: () => handOff(SHELL_ACTION),
		focus: () => focus.togglePlane(),
		quit: () => exit(),
	});

	const { columns } = useTuiViewport();
	const navWidth = columns < 90 ? 26 : 30;
	const shell = useShellLayout({ navWidth, navFlush: true, steps: true, action: true });
	const pageHeight = usePageHeight(`${step.id}:${step.status}`);
	const scrollable = pageHeight.height > shell.content.textRows - 2;
	// Tab switches panes only when one pane shows at a time.
	const keys = HUB_KEYS.filter((binding) => shell.narrow || binding.action !== "focus");
	const layout = fitFooter(shell, [
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning")] : []),
		textStatusSegment("state", `state in ${dirname(statePath())}`, "faintText", false, true),
	]);
	const scroll = usePageScroll(pageHeight, layout.content.textRows, true);
	const railWidth = (layout.nav ?? layout.content).textColumns;
	const path: PathStep[] = steps.map((s) => {
		const value = railValue(s.id, loaded.state);
		return {
			id: s.id,
			label: s.title,
			state: railState(s),
			// A value shows only where it fits beside the title.
			value: railWidth - 10 - s.title.length >= value.length ? value : undefined,
		};
	});
	return (
		<ContentWidth.Provider value={layout.content.textColumns}>
			<AppShell
				layout={layout}
				focus={layout.narrow ? focus.plane : "navigation"}
				navTitle="Install"
				nav={
					<StepPath
						steps={path}
						selected={step.id}
						width={railWidth}
						rows={(layout.nav ?? layout.content).textRows}
					/>
				}
				contentTitle={`step ${selected + 1} of ${steps.length}${scroll.more}`}
				progress={{
					total: steps.length,
					done: steps.filter((s) => s.status === "done").length,
					current: selected,
				}}
				action={pageAction(step, steps, loaded.error, layout.content.textColumns)}
				content={
					<Box
						ref={pageHeight.ref}
						flexDirection="column"
						flexShrink={0}
						marginTop={-scroll.offset}
					>
						<StepPage
							step={step}
							steps={steps}
							state={loaded.state}
							distro={distro}
							stateError={loaded.error}
						/>
					</Box>
				}
			/>
		</ContentWidth.Provider>
	);
}
