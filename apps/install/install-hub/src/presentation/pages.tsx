/**
 * The hub's pages: one per install step, each drawn from what the install state file
 * holds. A step you are at shows what goes where; a finished step shows what it left; a
 * step that waits shows what it will leave.
 */
import { Box } from "ink";
import { useContext, type ReactNode } from "react";
import {
	CellGrid,
	CellRows,
	Commands,
	ContentWidth,
	Facts,
	formatCount,
	FromTo,
	Heading,
	keyFor,
	shortDevice,
	truncateLine,
	UiText,
	useSurfaceBackground,
	type ColorIntent,
	type FactRows,
	type PageAction,
	type PageNote,
} from "@levitate/tui-kit";
import { LIVE_ROOTFS, MODE_NAME } from "@levitate/docs-content/install";
import type { Distro } from "@levitate/docs-content/distros";
import type { InstallState } from "@levitate/install-state";
import type { Step } from "../domain/steps";
import { HUB_KEYS } from "./keymap";

type Check = NonNullable<Step["checks"]>[number];

/** Narrower than this and the checks stack instead of standing side by side. */
const TILES_SIDE_BY_SIDE = 56;
/** Narrower than this and the note about doing a finished step again is shortened. */
const LONG_NOTE = 62;
/** Narrower than this and the machine card has one column of facts. */
const CARD_TWO_COLUMNS = 60;

/** A check's title and where it was looked for: "Install media mounted (/run/x)" is a
 * title and a place; a label without one falls back to the path checked. */
function splitCheck(check: Check): { title: string; place: string } {
	const parts = /^(.*?) \((.*)\)$/.exec(check.label);
	return parts ? { title: parts[1]!, place: parts[2]! } : { title: check.label, place: check.path };
}

/** The checks as tiles: a mark and what was checked, the place under it; a failed one in error. */
function Tiles({ checks }: { checks: readonly Check[] }): ReactNode {
	const width = useContext(ContentWidth);
	const side = checks.length === 2 && width >= TILES_SIDE_BY_SIDE;
	const half = side ? Math.floor((width - 2) / 2) : width;
	const grid = new CellGrid(width, side ? 3 : checks.length * 3, useSurfaceBackground());
	checks.forEach((check, i) => {
		const x = side ? i * (half + 2) : 0;
		const top = side ? 0 : i * 3;
		const tone: ColorIntent = check.ok ? "success" : "error";
		const { title, place } = splitCheck(check);
		for (const r of [top, top + 1]) {
			grid.fill(r, x, half, "raisedBackground");
			grid.put(r, x, "█", tone);
		}
		grid.put(
			top,
			x + 2,
			truncateLine(`${check.ok ? "✓" : "✗"} ${title}`, half - 3),
			tone,
			undefined,
			true,
		);
		grid.put(top + 1, x + 2, truncateLine(place, half - 3), "dimText");
	});
	return <CellRows grid={grid} />;
}

/** The boot entries of the disk's layout, as the boot step writes them. */
function BootCard({ state, distro }: { state: InstallState; distro: Distro }): ReactNode {
	const width = useContext(ContentWidth);
	const disk = state.steps.disk?.result;
	if (!disk) return null;
	const entries =
		disk.mode === "ab"
			? [
					[`${distro.osName} (slot A)`, disk.slot_a],
					[`${distro.osName} (slot B)`, disk.slot_b],
				]
			: [[distro.osName, disk.root_device]];
	const grid = new CellGrid(width, entries.length + 3, useSurfaceBackground());
	for (let r = 0; r < entries.length + 2; r++) grid.fill(r, 0, width, "panelBackground");
	grid.put(1, 2, `${disk.target}/boot`, "text", undefined, true);
	const room = Math.max(8, Math.floor((width - 6) / 2));
	entries.forEach(([name, device], i) => {
		grid.put(2 + i, 2, "▸", "accent");
		grid.put(2 + i, 4, truncateLine(name!, room), "text");
		if (device)
			grid.put(2 + i, 4 + room + 2, truncateLine(shortDevice(device), room - 2), "dimText");
	});
	return <CellRows grid={grid} />;
}

/** The machine as a card: its name on the accent, then what the install made of it. */
function MachineCard({ state, distro }: { state: InstallState; distro: Distro }): ReactNode {
	const width = useContext(ContentWidth);
	const { disk, setup } = state.steps;
	const left: [string, string][] = [];
	if (setup?.result.user) left.push(["Logs in", setup.result.user]);
	if (setup) left.push(["Setup", setup.result.manual ? "by hand" : "system-setup"]);
	const right: [string, string][] = [];
	if (disk) {
		right.push(["Disk", shortDevice(disk.result.disk)]);
		right.push(["Layout", MODE_NAME[disk.result.mode]]);
		right.push(["Root", disk.result.root_device ? shortDevice(disk.result.root_device) : "none"]);
	}
	const two = width >= CARD_TWO_COLUMNS;
	const columns: [string, string][][] = two ? [left, right] : [[...left, ...right]];
	const rows = Math.max(...columns.map((column) => column.length));
	const grid = new CellGrid(width, rows + 4, useSurfaceBackground());
	for (let r = 0; r < rows + 3; r++) grid.fill(r, 0, width, "panelBackground");
	grid.fill(0, 0, width, "accent");
	const name = setup?.result.hostname ?? "new system";
	grid.put(0, 2, truncateLine(name, width - 4), "contentBackground", undefined, true);
	const os = truncateLine(distro.osName, Math.max(0, width - name.length - 8));
	grid.put(0, width - os.length - 2, os, "contentBackground");
	const span = Math.floor(width / columns.length);
	columns.forEach((column, c) => {
		const label = Math.max(0, ...column.map(([k]) => k.length)) + 2;
		column.forEach(([key, value], i) => {
			const x = 2 + c * span;
			grid.put(2 + i, x, key, "dimText");
			grid.put(2 + i, x + label, truncateLine(value, Math.max(1, span - label - 3)), "text");
		});
	});
	return <CellRows grid={grid} />;
}

/** Hours and minutes of an ISO time, or nothing when it is not one. */
function clock(iso: string | undefined): string | null {
	if (!iso) return null;
	const at = new Date(iso);
	return Number.isNaN(at.getTime())
		? null
		: at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** The steps before `step` that are not done, in words. */
function waitsFor(step: Step, steps: readonly Step[]): string {
	const names = steps
		.slice(0, steps.indexOf(step))
		.filter((s) => s.status !== "done")
		.map((s) => `the ${s.title.toLowerCase()}`);
	return names.length < 2
		? (names[0] ?? "the steps before it")
		: `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const TITLE: Record<Step["id"], { ahead: string; done: string }> = {
	preflight: {
		ahead: "Can this machine take the install?",
		done: "This machine can take the install",
	},
	disk: { ahead: "Lay out the disk", done: "The disk is laid out" },
	base: { ahead: "Put the system on the disk", done: "The system is on the disk" },
	setup: { ahead: "Configure the new system", done: "The system is configured" },
	boot: { ahead: "Install the boot loader", done: "The boot loader is installed" },
	finish: { ahead: "Unmount and reboot", done: "Unmount and reboot" },
};

/** Pages whose title already says what the step's own line says. */
const SUBTITLE: Partial<Record<Step["id"], string>> = {
	preflight: "These must hold before anything is touched.",
	boot: "The boot entries for the disk's layout.",
};

function PageHeading({ step, index }: { step: Step; index: number }): ReactNode {
	const failed = step.checks?.filter((check) => !check.ok) ?? [];
	if (step.status === "current" && failed.length > 0) {
		return (
			<Heading
				glyph="bang"
				tone="error"
				title="This boot cannot take the install"
				subtitle={failed.length === 1 ? "One check does not hold." : "Some checks do not hold."}
			/>
		);
	}
	if (step.id === "finish" && step.status === "current") {
		return (
			<Heading
				glyph="check"
				tone="success"
				title="Ready to reboot"
				subtitle="The install is complete."
			/>
		);
	}
	if (step.status === "done") {
		const at = clock(step.doneAt);
		return (
			<Heading
				step={index + 1}
				title={TITLE[step.id].done}
				subtitle={at ? `Done at ${at}.` : step.summary}
			/>
		);
	}
	return (
		<Heading
			step={index + 1}
			title={TITLE[step.id].ahead}
			subtitle={SUBTITLE[step.id] ?? step.about}
		/>
	);
}

/** What a finished step left. */
function Receipt({
	step,
	state,
	distro,
}: {
	step: Step;
	state: InstallState;
	distro: Distro;
}): ReactNode {
	const { disk, base, setup } = state.steps;
	const rows: FactRows =
		step.id === "disk" && disk
			? [
					["Disk", `${disk.result.disk}, ${MODE_NAME[disk.result.mode]}`],
					...disk.result.mounts.map((mount): [string, string] => [mount.path, mount.device]),
					...(disk.result.slot_a ? [["Slot A", disk.result.slot_a] as [string, string]] : []),
					...(disk.result.slot_b ? [["Slot B", disk.result.slot_b] as [string, string]] : []),
				]
			: step.id === "base" && base
				? [
						["From", base.result.rootfs ?? "the live image"],
						["Onto", base.result.target],
						...(base.result.entries === null
							? []
							: [["Files", formatCount(base.result.entries)] as [string, string]]),
						["fstab", base.result.fstab],
					]
				: step.id === "setup" && setup
					? [
							["Done", setup.result.manual ? "by hand, marked done" : "by system-setup"],
							...(setup.result.hostname
								? [["Hostname", setup.result.hostname] as [string, string]]
								: []),
							...(setup.result.user ? [["User", setup.result.user] as [string, string]] : []),
						]
					: [];
	if (step.id === "preflight") return <Tiles checks={step.checks ?? []} />;
	if (step.id === "boot") return <BootCard state={state} distro={distro} />;
	return rows.length > 0 ? <Facts rows={rows} /> : null;
}

/** What goes where, for the steps that move something. */
function Launch({
	step,
	state,
	distro,
}: {
	step: Step;
	state: InstallState;
	distro: Distro;
}): ReactNode {
	const disk = state.steps.disk?.result;
	if (!disk) return null;
	const root = disk.root_device ? shortDevice(disk.root_device) : disk.disk;
	if (step.id === "base") {
		return (
			<FromTo
				from={{ title: "The live image", lines: [LIVE_ROOTFS] }}
				to={{
					title: disk.target,
					lines: [disk.mode === "ab" ? `${root}, slot A` : root, MODE_NAME[disk.mode]],
				}}
			/>
		);
	}
	if (step.id === "setup") {
		return (
			<FromTo
				from={{ title: "The copied system", lines: [disk.target] }}
				to={{
					title: "Configured",
					lines: ["Time zone", "Locale and keymap", "Hostname and a user"],
				}}
			/>
		);
	}
	if (step.id === "boot") return <BootCard state={state} distro={distro} />;
	return null;
}

/** The page of `step`: `index` is its place in the list, `stateError` why nothing can be done. */
export function StepPage({
	step,
	steps,
	state,
	distro,
	stateError,
}: {
	step: Step;
	steps: readonly Step[];
	state: InstallState;
	distro: Distro;
	stateError: string | null;
}): ReactNode {
	const index = steps.indexOf(step);
	const action = step.action;
	const failed = step.checks?.find((check) => !check.ok);
	return (
		<>
			<PageHeading step={step} index={index} />
			{stateError ? (
				<UiText intent="warning">{stateError}</UiText>
			) : step.status === "done" ? (
				<Receipt step={step} state={state} distro={distro} />
			) : (
				<>
					{step.checks ? <Tiles checks={step.checks} /> : null}
					<Launch step={step} state={state} distro={distro} />
					{step.status === "current" && step.id === "boot" && action.kind === "run" ? (
						<Commands lines={action.lines} />
					) : null}
				</>
			)}
			{step.status === "current" && failed ? <UiText>{failed.fix}</UiText> : null}
			{step.status === "current" && step.checks && !failed ? (
				<UiText intent="dimText">
					Nothing on any disk changes before you type DESTROY in the Disk step.
				</UiText>
			) : null}
			{step.status === "current" && step.id === "finish" ? (
				<>
					<MachineCard state={state} distro={distro} />
					<Box marginTop={1}>
						<UiText intent="warning">Remove the install media when the machine restarts.</UiText>
					</Box>
				</>
			) : null}
			{step.status === "current" && action.kind === "app" && action.byHand ? (
				<UiText intent="dimText">
					Typed the guide's commands in the shell instead? {keyFor(HUB_KEYS, "mark")} marks the step
					done.
				</UiText>
			) : null}
		</>
	);
}

/** The page's one thing to press, or its one quiet line. */
export function pageAction(
	step: Step,
	steps: readonly Step[],
	stateError: string | null,
	width: number,
): PageAction | PageNote | undefined {
	const action = step.action;
	if (stateError) return undefined;
	if (step.status === "blocked") return { note: `Waits for ${waitsFor(step, steps)}.` };
	if (step.status === "done") {
		if (action.kind === "none") return undefined;
		const again =
			action.kind === "app"
				? `opens ${action.argv[0]} again`
				: action.kind === "record"
					? "checks again"
					: "runs it again";
		return {
			note:
				width >= LONG_NOTE
					? `Enter ${again}. That drops every step after it.`
					: "Enter does it again, dropping later steps.",
		};
	}
	if (action.kind === "none") {
		return step.checks ? undefined : { note: action.why, intent: "warning" };
	}
	return { label: action.label, key: "Enter" };
}
