/** The partition editor page: the next step to take, the disk as the edits leave it, what
 * the selected partition can do, and what the system still needs. */
import { Box, Text } from "ink";
import { useContext, type ReactNode } from "react";
import {
	Callout,
	ContentWidth,
	Facts,
	resolveIntentColor,
	Section,
	Table,
	UiText,
	useTuiColors,
	useTuiTheme,
	type ColorIntent,
	type Tone,
} from "@levitate/tui-kit";
import type { InspectResult, InstallMode, PartitionPlan } from "../generated/recpart";
import type { Run } from "../flow";
import { formatBytes } from "../domain/recpart";
import { MIB, requiredRoles, type Projection, type Segment } from "../domain/layout";
import { neededMb, roleLabel, ROLE_NAME, ROLE_PURPOSE } from "../domain/setup";
import { sizeAnswer, type PartitionEditor, type Prompt } from "./use-partition-editor";

function useIntent(intent: ColorIntent): string | undefined {
	return resolveIntentColor(useTuiTheme(), intent, useTuiColors());
}

const MODE_NAME: Record<InstallMode, string> = { ab: "A/B", mutable: "the system" };

function short(device: string): string {
	return device.replace(/^\/dev\//, "");
}

/** What the Change column says, and how loudly. */
function change(segment: Segment): { text: string; tone: ColorIntent | null } {
	if (segment.kind === "free") return { text: "", tone: "dimText" };
	if (segment.kind === "new")
		return segment.fits ? { text: "new", tone: "success" } : { text: "doesn't fit", tone: "error" };
	switch (segment.edit.op) {
		case "resize":
			return {
				text: segment.size < segment.part.size_bytes ? "shrunk" : "grown",
				tone: "warning",
			};
		case "format":
			return { text: "erased (formatted)", tone: "error" };
		default:
			return segment.role ? { text: "kept", tone: null } : { text: "untouched", tone: "dimText" };
	}
}

function name(segment: Segment): string {
	if (segment.kind === "free") return "free space";
	if (segment.kind === "new") return "(new)";
	return short(segment.part.device);
}

/** What is on it: filesystem and label. */
function holds(segment: Segment): string {
	if (segment.kind === "free") return "";
	if (segment.kind === "new")
		return (
			segment.part.filesystem ??
			(segment.role === "efi" ? "vfat" : segment.role === "swap" ? "swap" : "ext4")
		);
	const fs = segment.edit.op === "format" ? segment.edit.filesystem : segment.part.filesystem;
	const label = segment.edit.op === "format" ? null : (segment.part.fs_label ?? segment.part.label);
	return [fs, label ? `"${label}"` : null].filter(Boolean).join(" ");
}

const SEGMENT_INTENTS: readonly ColorIntent[] = ["accent", "success", "warning", "info", "link"];

/** The disk as one bar, each segment as wide as its share; free space is dotted and the
 * selected segment is drawn solid. */
function SegmentBar({
	projection,
	selected,
}: {
	projection: Projection;
	selected: number;
}): ReactNode {
	const width = useContext(ContentWidth);
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const total = Math.max(1, projection.usableEnd - projection.usableStart);
	const segments = projection.segments;
	const spare = Math.max(0, width - segments.length);
	const cells = segments.map((s) => 1 + Math.floor((spare * s.size) / total));
	const short = width - cells.reduce((a, b) => a + b, 0);
	if (cells.length > 0) {
		const biggest = segments.reduce((best, s, i) => (s.size > segments[best]!.size ? i : best), 0);
		cells[biggest]! += Math.max(0, short);
	}
	let partIndex = 0;
	return (
		<Text>
			{segments.map((segment, i) => {
				const intent: ColorIntent =
					segment.kind === "free"
						? "dimText"
						: SEGMENT_INTENTS[partIndex++ % SEGMENT_INTENTS.length]!;
				const glyph = segment.kind === "free" ? "·" : i === selected ? "█" : "▒";
				return (
					<Text key={i} color={resolveIntentColor(theme, intent, colors)} bold={i === selected}>
						{glyph.repeat(cells[i]!)}
					</Text>
				);
			})}
		</Text>
	);
}

/** The question being asked, with what an answer may be. */
function PromptBox({ editor }: { editor: PartitionEditor }): ReactNode {
	const dim = useIntent("dimText");
	const accent = useIntent("accent");
	const text = useIntent("text");
	const ok = useIntent("success");
	const bad = useIntent("warning");
	const prompt = editor.prompt;
	if (!prompt) return null;
	if (prompt.kind === "choice") {
		const labelWidth = Math.max(...prompt.options.map((o) => o.label.length)) + 4;
		return (
			<Callout tone="info" title={prompt.title}>
				{prompt.options.map((option, i) => (
					<Box key={option.label} flexDirection="row">
						<Box width={labelWidth} flexShrink={0}>
							<Text bold={i === prompt.index} color={i === prompt.index ? accent : text}>
								{i === prompt.index ? "▸ " : "  "}
								{option.label}
							</Text>
						</Box>
						<Box flexGrow={1} flexShrink={1}>
							<Text color={dim}>{option.help ?? ""}</Text>
						</Box>
					</Box>
				))}
				<Text color={dim}>↑/↓ choose · Enter accept · Esc cancel</Text>
			</Callout>
		);
	}
	if (prompt.kind === "room") return <RoomSlider prompt={prompt} />;
	const answer = prompt.kind === "size" ? sizeAnswer(prompt) : null;
	return (
		<Callout tone="info" title={prompt.title}>
			<Text>
				<Text color={dim}>› </Text>
				<Text bold>{prompt.text}</Text>
				<Text color={dim}>_</Text>
				{answer ? (
					<Text color={answer.kind === "ok" ? ok : bad}>
						{answer.kind === "ok" ? `   = ${formatBytes(answer.mb * MIB)}` : `   ${answer.message}`}
					</Text>
				) : null}
			</Text>
			<UiText intent="dimText">
				{prompt.kind === "size"
					? `20G, 512M, 50% or rest (a bare number is GiB) · ${formatBytes(prompt.minMb * MIB)} to ${formatBytes(prompt.maxMb * MIB)} · Enter accept · Esc cancel`
					: `${prompt.hint} · Enter accept · Esc cancel`}
			</UiText>
		</Callout>
	);
}

/** Making room: the partition and the space it gives up as one bar with a divider, its
 * files drawn solid, and both sizes under it. */
function RoomSlider({ prompt }: { prompt: Extract<Prompt, { kind: "room" }> }): ReactNode {
	const width = Math.max(10, useContext(ContentWidth) - 4);
	const files = useIntent("accent");
	const dim = useIntent("dimText");
	const free = useIntent("success");
	const bad = useIntent("warning");
	const room = prompt.maxMb - prompt.sizeMb;
	const cells = (mb: number) => Math.round((mb / Math.max(1, prompt.maxMb)) * (width - 1));
	const keep = Math.max(1, cells(prompt.sizeMb));
	const used = Math.min(keep, prompt.usedMb === null ? 0 : Math.max(1, cells(prompt.usedMb)));
	const left = `${prompt.name}: ${formatBytes(prompt.sizeMb * MIB)}`;
	const right = `for the new system: ${formatBytes(room * MIB)}`;
	const gap = Math.max(1, width - left.length - right.length);
	return (
		<Callout tone="info" title={prompt.title}>
			<UiText>Its files stay where they are; only space it doesn't use is given up.</UiText>
			<Box marginTop={1} flexDirection="column">
				<Text>
					<Text color={files}>{"█".repeat(used)}</Text>
					<Text color={files}>{"▒".repeat(keep - used)}</Text>
					<Text bold>│</Text>
					<Text color={free}>{"·".repeat(Math.max(0, width - 1 - keep))}</Text>
				</Text>
				{left.length + right.length + 1 <= width ? (
					<Text>
						<Text bold>{left}</Text>
						{" ".repeat(gap)}
						<Text bold color={room < prompt.needMb ? bad : free}>
							{right}
						</Text>
					</Text>
				) : (
					<>
						<Text bold>{left}</Text>
						<Text bold color={room < prompt.needMb ? bad : free}>
							{right}
						</Text>
					</>
				)}
			</Box>
			{prompt.text ? (
				<Text>
					<Text color={dim}>room › </Text>
					<Text bold>{prompt.text}</Text>
					<Text color={dim}>_</Text>
				</Text>
			) : null}
			<Box marginTop={1} flexDirection="column">
				{room < prompt.needMb ? (
					<UiText intent="warning">{`The new system needs at least ${formatBytes(prompt.needMb * MIB)}: move left.`}</UiText>
				) : null}
				<UiText intent="dimText">
					{"← more room · → less · or type how much room (100G) · Enter shrinks · Esc cancels"}
				</UiText>
				<UiText intent="dimText">
					{`${prompt.name} can't go below ${formatBytes(prompt.minMb * MIB)}${prompt.usedMb !== null ? `: ${formatBytes(prompt.usedMb * MIB)} of files plus a margin` : ""}. It is ${formatBytes(prompt.nowMb * MIB)} now.`}
				</UiText>
			</Box>
		</Callout>
	);
}

type Guide = { tone: Tone; title: string; lines: ReactNode[] };

/** The one next step: make room, fill the free space, fix what recpart refuses, or go on. */
function guide(editor: PartitionEditor, mode: InstallMode, plan: Run<PartitionPlan>): Guide {
	const name = MODE_NAME[mode];
	if (editor.missing.length === 0) {
		if (plan.kind === "ok")
			return {
				tone: "success",
				title: "Ready: recpart accepts this layout",
				lines: ["Enter continues to the plan. Nothing is written until the Confirm step."],
			};
		if (plan.kind === "failed")
			return plan.error
				? {
						tone: "warning",
						title: "recpart doesn't accept this yet",
						lines: [
							<UiText key="r" bold>
								{plan.error.remediation}
							</UiText>,
							<UiText key="d" intent="dimText">
								{`${plan.error.observed} (${plan.error.code})`}
							</UiText>,
						],
					}
				: { tone: "danger", title: "recpart couldn't check the layout", lines: [plan.output] };
		return { tone: "info", title: "Checking the layout with recpart …", lines: [] };
	}
	const setup = editor.setup;
	if (setup?.kind === "ok")
		return {
			tone: "info",
			title: `Next: press a to set up ${name} in the ${formatBytes(setup.freeMb * MIB)} free`,
			lines: [
				...setup.steps.map((step) => (
					<Text key={step.what}>
						{"• "}
						<Text bold>{step.what}</Text>
						{`: ${step.detail}`}
					</Text>
				)),
				<UiText key="own" intent="dimText">
					Or place them yourself: select free space, n makes a partition, m says what it is for.
				</UiText>,
			],
		};
	const need = formatBytes(neededMb(mode) * MIB);
	const shrink = editor.shrink;
	if (shrink) {
		const label = shrink.part.fs_label ?? shrink.part.label;
		return {
			tone: "info",
			title: `Next: press s to make room for ${name}`,
			lines: [
				`There isn't ${need} of free space in one place, which ${mode === "ab" ? "A/B" : "the system"} needs.`,
				<Text key="s">
					{"s shrinks "}
					<Text bold>{`${short(shrink.part.device)}${label ? ` ("${label}")` : ""}`}</Text>
					{` without touching its files: it can give up to ${formatBytes(shrink.spareMb * MIB)}. You choose how much with ← and →.`}
				</Text>,
			],
		};
	}
	return {
		tone: "warning",
		title: `There's no room for ${name}`,
		lines: [
			`It needs at least ${need} of free space in one place.`,
			"Delete a partition (d) to free its space, or W starts over with an empty partition table, erasing everything.",
		],
	};
}

/** A key and what it does, as on a button. */
function KeyChip({ hotkey, label, tone }: { hotkey: string; label: string; tone?: ColorIntent }) {
	const accent = useIntent("accent");
	const color = useIntent(tone ?? "text");
	return (
		<Text>
			<Text inverse bold color={accent}>{` ${hotkey} `}</Text>
			<Text color={color}>{` ${label}`}</Text>
		</Text>
	);
}

/** The selected row: what it is, and what can be done to it. */
function Selected({
	segment,
	editor,
	mode,
}: {
	segment: Segment;
	editor: PartitionEditor;
	mode: InstallMode;
}): ReactNode {
	const has = (action: string) => editor.keys.some((binding) => binding.action === action);
	let what: string;
	let chips: Array<{ hotkey: string; label: string; tone?: ColorIntent }>;
	if (segment.kind === "free") {
		what = `${formatBytes(segment.size)} of free space`;
		chips = [
			...(has("setup") ? [{ hotkey: "a", label: `Set up ${MODE_NAME[mode]} here` }] : []),
			{ hotkey: "n", label: "New partition here" },
		];
	} else if (segment.kind === "new") {
		what = `A new ${formatBytes(segment.size)} partition${segment.role ? `: ${roleLabel(segment.role, segment.mountpoint)}` : ""}`;
		chips = [
			{ hotkey: "m", label: "Use as…" },
			{ hotkey: "r", label: "Change size" },
			{ hotkey: "f", label: "Filesystem" },
			{ hotkey: "d", label: "Remove" },
		];
	} else {
		const part = segment.part;
		const label = part.fs_label ?? part.label;
		what = [
			`${short(part.device)}: ${formatBytes(part.size_bytes)} now`,
			part.filesystem ?? "no filesystem",
			label ? `"${label}"` : null,
			part.used_bytes !== null ? `${formatBytes(part.used_bytes)} used` : null,
			part.mountpoints.length ? `mounted at ${part.mountpoints.join(", ")}` : null,
		]
			.filter(Boolean)
			.join(" · ");
		const resizable = part.min_size_bytes !== null;
		chips = [
			{ hotkey: "m", label: "Use as…" },
			...(resizable
				? [
						{
							hotkey: "r",
							label: "Make smaller or bigger (keeps its files)",
						},
					]
				: []),
			{ hotkey: "f", label: "Format (erases it)", tone: "warning" as const },
			{ hotkey: "d", label: "Delete (erases it)", tone: "warning" as const },
			...(has("clear") ? [{ hotkey: "x", label: "Leave as it is" }] : []),
		];
	}
	return (
		<Section title="Selected" trailing="↑/↓ moves">
			<UiText>{what}</UiText>
			{segment.kind === "existing" && segment.edit.op !== "keep" ? (
				<UiText intent="warning">
					{segment.edit.op === "resize"
						? `Change: ${change(segment).text} to ${formatBytes(segment.size)}`
						: `Change: ${change(segment).text}`}
				</UiText>
			) : null}
			{segment.kind !== "free" && segment.role ? (
				<UiText intent="dimText">{`Used as ${roleLabel(segment.role, segment.mountpoint)}: ${ROLE_PURPOSE[segment.role]}`}</UiText>
			) : null}
			<Box flexDirection="row" flexWrap="wrap" columnGap={2} marginTop={1}>
				{chips.map((chip) => (
					<KeyChip key={chip.hotkey} {...chip} />
				))}
			</Box>
		</Section>
	);
}

export function PartitionEditorPage({
	inspect,
	editor,
	mode,
	plan,
}: {
	inspect: Run<InspectResult>;
	editor: PartitionEditor;
	mode: InstallMode;
	plan: Run<PartitionPlan>;
}): ReactNode {
	const okColor = useIntent("success");
	const heading = (
		<Box flexDirection="column" marginBottom={1}>
			<UiText bold intent="heading">
				Edit the partitions
			</UiText>
			<UiText intent="dimText">Nothing is written until the Confirm step.</UiText>
		</Box>
	);
	if (inspect.kind === "failed")
		return (
			<Box flexDirection="column">
				{heading}
				<Callout tone="danger" title="recpart couldn't read the disk">
					<UiText>{inspect.error ? inspect.error.observed : inspect.output}</UiText>
					{inspect.error ? <UiText intent="warning">{inspect.error.remediation}</UiText> : null}
				</Callout>
			</Box>
		);
	const projection = editor.projection;
	if (inspect.kind !== "ok" || !projection)
		return (
			<Box flexDirection="column">
				{heading}
				<UiText intent="dimText">Reading the disk with recpart inspect …</UiText>
			</Box>
		);
	const { disk, table } = inspect.value;
	const step = guide(editor, mode, plan);
	const segment = projection.segments[editor.selected];
	const holdersOf = (role: string) =>
		projection.segments.flatMap((s) =>
			s.kind !== "free" && s.role === role
				? [
						s.kind === "new"
							? `new, ${formatBytes(s.size)}`
							: `${short(s.part.device)}, ${change(s).text}`,
					]
				: [],
		);
	return (
		<Box flexDirection="column">
			{heading}
			<PromptBox editor={editor} />
			{editor.prompt ? null : (
				<Callout tone={step.tone} title={step.title}>
					{step.lines.map((line, i) =>
						typeof line === "string" ? <UiText key={i}>{line}</UiText> : line,
					)}
				</Callout>
			)}
			<Section
				title={disk.path}
				trailing={`${formatBytes(disk.size_bytes)} · ${editor.edits.newTable ? "new partition table" : `${table} table`}`}
			>
				<SegmentBar projection={projection} selected={editor.selected} />
				<Box marginTop={1}>
					<Table
						selected={editor.selected}
						tones={projection.segments.map((s) => change(s).tone)}
						columns={[
							{ title: "Partition" },
							{ title: "Size", align: "right" },
							{ title: "Holds", optional: true },
							{ title: "Used as" },
							{ title: "Change" },
						]}
						rows={projection.segments.map((s) => [
							name(s),
							formatBytes(s.size),
							holds(s),
							s.kind === "free" ? "" : roleLabel(s.role, s.mountpoint),
							change(s).text,
						])}
					/>
				</Box>
			</Section>
			{segment && !editor.prompt ? (
				<Selected segment={segment} editor={editor} mode={mode} />
			) : null}
			{editor.notice ? (
				<Box marginBottom={1}>
					<UiText intent="warning">{editor.notice}</UiText>
				</Box>
			) : null}
			{projection.erased.length ? (
				<Section title="Erased" trailing={`${projection.erased.length}`}>
					<UiText intent="error">
						{projection.erased
							.map(
								(p) =>
									`${short(p.device)} ${formatBytes(p.size_bytes)}${p.filesystem ? ` ${p.filesystem}` : ""}`,
							)
							.join(" · ")}
					</UiText>
				</Section>
			) : null}
			<Section title={`${mode === "ab" ? "A/B" : "The system"} needs`}>
				<Facts
					rows={requiredRoles(mode).map((role) => {
						const held = holdersOf(role);
						return [
							ROLE_NAME[role],
							held.length ? (
								<Text key={role} color={okColor}>{`✓ ${held.join("; ")}`}</Text>
							) : (
								`○ not yet: ${ROLE_PURPOSE[role]}`
							),
						];
					})}
				/>
			</Section>
		</Box>
	);
}
