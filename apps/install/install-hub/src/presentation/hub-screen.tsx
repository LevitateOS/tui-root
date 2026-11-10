import { Box, Text, useApp } from "ink";
import { useState, type ReactNode } from "react";
import {
	AppShell,
	Callout,
	Commands,
	ContentWidth,
	Facts,
	fitFooter,
	keymapStatusSegments,
	keyFor,
	movesBack,
	PAGE_SCROLL_KEYS,
	Section,
	textStatusSegment,
	UiText,
	useFocusPlane,
	useKeymap,
	usePageHeight,
	usePageScroll,
	useHandOff,
	useIntentColor,
	useShellLayout,
	type ColorIntent,
} from "@levitate/tui-kit";
import { statePath } from "@levitate/install-state";
import type { Distro } from "@levitate/docs-content/distros";
import { exists, loadState, record, SHELL_ACTION, type Live } from "../app/handoff";
import { guideTitle } from "@levitate/docs-content/install";
import { installSteps, type Action, type Step, type StepStatus } from "../domain/steps";
import { HUB_KEYS } from "./keymap";

const MARK: Record<StepStatus, { mark: string; intent: ColorIntent }> = {
	done: { mark: "✓", intent: "success" },
	current: { mark: "▸", intent: "accent" },
	blocked: { mark: "○", intent: "dimText" },
};

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

	const shell = useShellLayout({ navWidth: 22 });
	const pageHeight = usePageHeight(`${step.id}:${step.status}`);
	const scrollable = pageHeight.height > shell.content.textRows - 2;
	// Tab switches panes only when one pane shows at a time.
	const keys = HUB_KEYS.filter((binding) => shell.narrow || binding.action !== "focus");
	const layout = fitFooter(shell, [
		...keymapStatusSegments(scrollable ? [...keys, ...PAGE_SCROLL_KEYS] : keys),
		...(notice ? [textStatusSegment("notice", notice, "warning")] : []),
	]);
	const scroll = usePageScroll(pageHeight, layout.content.textRows, true);
	return (
		<ContentWidth.Provider value={layout.content.textColumns}>
			<AppShell
				layout={layout}
				focus={layout.narrow ? focus.plane : "navigation"}
				navTitle={`${distro.osName} install`}
				nav={<StepRail steps={steps} selected={selected} />}
				contentTitle={`${step.title}${scroll.more}`}
				content={
					<Box
						ref={pageHeight.ref}
						flexDirection="column"
						flexShrink={0}
						marginTop={-scroll.offset}
					>
						<StepPage step={step} statePath={statePath()} />
					</Box>
				}
			/>
		</ContentWidth.Provider>
	);
}

function StepRail({ steps, selected }: { steps: readonly Step[]; selected: number }): ReactNode {
	const color = useIntentColor();
	return (
		<Box flexDirection="column">
			{steps.map((step, i) => {
				const { mark, intent } = MARK[step.status];
				return (
					<Text key={step.id}>
						<Text color={color(i === selected ? "accent" : "dimText")}>
							{i === selected ? "› " : "  "}
						</Text>
						<Text color={color(intent)}>{mark} </Text>
						<Text
							bold={i === selected}
							color={color(step.status === "blocked" ? "dimText" : "navItem")}
						>
							{step.title}
						</Text>
					</Text>
				);
			})}
		</Box>
	);
}

function StepPage({ step, statePath }: { step: Step; statePath: string }): ReactNode {
	const action = step.action;
	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<UiText intent="dimText">{step.about}</UiText>
			</Box>
			{step.status === "done" ? (
				<Callout tone="success" title="Done">
					{step.summary ? <UiText intent="dimText">{step.summary}</UiText> : null}
					{action.kind !== "none" ? (
						<UiText intent="dimText">Doing it again drops the steps after it.</UiText>
					) : null}
				</Callout>
			) : step.status === "blocked" ? (
				<UiText intent="dimText">Waits for the steps before it.</UiText>
			) : null}
			{step.checks ? (
				<Section title="Checks">
					<Facts
						rows={step.checks.map((check) => [
							check.ok ? "✓" : "✗",
							<Text key={check.label}>
								{check.label}
								{check.ok || !check.fix ? "" : `. ${check.fix}`}
							</Text>,
						])}
					/>
				</Section>
			) : null}
			{action.kind === "app" ? (
				<Section title={`${keyFor(HUB_KEYS, "start")} starts`}>
					<Commands lines={[action.argv.join(" ")]} />
					{action.byHand ? (
						<UiText intent="dimText">
							Typed the guide's commands in the shell instead? {keyFor(HUB_KEYS, "mark")} marks the
							step done.
						</UiText>
					) : null}
				</Section>
			) : action.kind === "run" ? (
				<Section title={`${keyFor(HUB_KEYS, "start")} runs`}>
					<Commands lines={action.lines} />
				</Section>
			) : action.kind === "none" ? (
				<UiText intent="dimText">{action.why}</UiText>
			) : null}
			<UiText intent="dimText">
				The guide beside this has the step in full: {guideTitle(step.guide.slug)}
				{step.guide.section ? `, ${step.guide.section}` : ""}. Progress is kept in {statePath}.
			</UiText>
		</Box>
	);
}
