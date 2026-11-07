/** The partition editor page: the disk as the edits leave it, what the mode still needs,
 * recpart's verdict on the layout, and the question being asked. */
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
} from "@levitate/tui-kit";
import type { InspectResult, InstallMode, PartitionPlan } from "../generated/recpart";
import type { Run } from "../flow";
import { formatBytes } from "../domain/recpart";
import { requiredRoles, type Projection, type Segment } from "../domain/layout";
import { sizeAnswer, type PartitionEditor } from "./use-partition-editor";

/** What the Change column says, and how loudly. */
function change(segment: Segment): { text: string; tone: ColorIntent | null } {
	if (segment.kind === "free") return { text: "", tone: "dimText" };
	if (segment.kind === "new")
		return segment.fits ? { text: "new", tone: "success" } : { text: "doesn't fit", tone: "error" };
	switch (segment.edit.op) {
		case "resize":
			return {
				text: segment.size < segment.part.size_bytes ? "shrink" : "grow",
				tone: "warning",
			};
		case "format":
			return { text: "format (erases)", tone: "error" };
		default:
			return { text: segment.role ? "keep" : "untouched", tone: null };
	}
}

function use(segment: Segment): string {
	if (segment.kind === "free") return "";
	if (!segment.role) return "";
	return segment.role === "other" ? (segment.mountpoint ?? "other") : segment.role;
}

function filesystem(segment: Segment): string {
	if (segment.kind === "free") return "";
	if (segment.kind === "new")
		return (
			segment.part.filesystem ??
			(segment.role === "efi" ? "vfat" : segment.role === "swap" ? "swap" : "ext4")
		);
	if (segment.edit.op === "format") return segment.edit.filesystem;
	return segment.part.filesystem ?? "";
}

function name(segment: Segment): string {
	if (segment.kind === "free") return "free space";
	if (segment.kind === "new") return "(new)";
	return segment.part.device.replace(/^\/dev\//, "");
}

function detail(segment: Segment): string {
	if (segment.kind !== "existing") return "";
	const { part } = segment;
	return [
		segment.edit.op === "resize" ? `was ${formatBytes(part.size_bytes)}` : null,
		part.fs_label ?? part.label,
		part.used_bytes !== null ? `${formatBytes(part.used_bytes)} used` : null,
		part.mountpoints.length ? `mounted ${part.mountpoints.join(", ")}` : null,
	]
		.filter(Boolean)
		.join(" · ");
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
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const prompt = editor.prompt;
	if (!prompt) return null;
	const dim = resolveIntentColor(theme, "dimText", colors);
	if (prompt.kind === "choice")
		return (
			<Callout tone="info" title={prompt.title}>
				{prompt.options.map((option, i) => (
					<Box key={option.label} flexDirection="row">
						<Box width={11} flexShrink={0}>
							<Text
								bold={i === prompt.index}
								color={resolveIntentColor(theme, i === prompt.index ? "accent" : "text", colors)}
							>
								{i === prompt.index ? "▸ " : "  "}
								{option.label}
							</Text>
						</Box>
						<Box flexGrow={1} flexShrink={1}>
							<Text color={dim}>{option.help ?? ""}</Text>
						</Box>
					</Box>
				))}
			</Callout>
		);
	const answer = prompt.kind === "size" ? sizeAnswer(prompt) : null;
	return (
		<Callout tone="info" title={prompt.title}>
			<Text>
				<Text color={dim}>› </Text>
				<Text bold>{prompt.text}</Text>
				<Text color={dim}>_</Text>
				{answer ? (
					<Text
						color={resolveIntentColor(theme, answer.kind === "ok" ? "success" : "warning", colors)}
					>
						{answer.kind === "ok"
							? `   = ${formatBytes(answer.mb * 1024 * 1024)}`
							: `   ${answer.message}`}
					</Text>
				) : null}
			</Text>
			<UiText intent="dimText">
				{prompt.kind === "size"
					? `20G, 512M, 1.5T, 50% or rest (a bare number is GiB) · ${formatBytes(prompt.minMb * 1024 * 1024)} to ${formatBytes(prompt.maxMb * 1024 * 1024)}`
					: prompt.hint}
			</UiText>
		</Callout>
	);
}

/** recpart's verdict on the layout as it stands. */
function Check({ plan, mode }: { plan: Run<PartitionPlan>; mode: InstallMode }): ReactNode {
	if (plan.kind === "idle" || plan.kind === "running")
		return <UiText intent="dimText">Checking the layout with recpart …</UiText>;
	if (plan.kind === "failed")
		return plan.error ? (
			<Callout tone="warning" title={`Not a valid ${mode} layout yet`}>
				<UiText bold>{plan.error.remediation}</UiText>
				<UiText intent="dimText">{`recpart: expected ${plan.error.expectation}; found ${plan.error.observed} (${plan.error.code})`}</UiText>
			</Callout>
		) : (
			<Callout tone="danger" title="recpart couldn't check the layout">
				<UiText>{plan.output}</UiText>
			</Callout>
		);
	const counts = new Map<string, number>();
	for (const entry of plan.value.summary)
		counts.set(entry.change, (counts.get(entry.change) ?? 0) + 1);
	const text = ["erased", "formatted", "resized", "created", "untouched"]
		.filter((kind) => counts.get(kind))
		.map((kind) => `${counts.get(kind)} ${kind}`)
		.join(" · ");
	return (
		<Callout tone="success" title={`recpart accepts this ${mode} layout`}>
			<UiText intent="dimText">{text}</UiText>
		</Callout>
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
	const heading = (
		<Box flexDirection="column" marginBottom={1}>
			<UiText bold intent="heading">
				Edit the partitions
			</UiText>
			<UiText intent="dimText">
				Nothing is written until the Confirm step. recpart checks the layout after every change.
			</UiText>
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
	const holders = (role: string) =>
		projection.segments.filter((s) => s.kind !== "free" && s.role === role).map(name);
	const rows = projection.segments.map((segment) => [
		name(segment),
		formatBytes(segment.size),
		filesystem(segment),
		use(segment),
		change(segment).text,
		detail(segment),
	]);
	return (
		<Box flexDirection="column">
			{heading}
			<PromptBox editor={editor} />
			<Section
				title={disk.path}
				trailing={`${formatBytes(disk.size_bytes)} · ${editor.edits.newTable ? "new GPT table" : `${table} table`}`}
			>
				<SegmentBar projection={projection} selected={editor.selected} />
				<Box marginTop={1}>
					<Table
						selected={editor.selected}
						tones={projection.segments.map((s) => change(s).tone)}
						columns={[
							{ title: "Partition" },
							{ title: "Size", align: "right" },
							{ title: "FS", optional: true },
							{ title: "Use" },
							{ title: "Change" },
							{ title: "Details", optional: true },
						]}
						rows={rows}
					/>
				</Box>
			</Section>
			{projection.erased.length ? (
				<Section title="Erased" trailing={`${projection.erased.length}`}>
					<UiText intent="error">
						{projection.erased
							.map(
								(p) =>
									`${p.device} ${formatBytes(p.size_bytes)}${p.filesystem ? ` ${p.filesystem}` : ""}`,
							)
							.join(" · ")}
					</UiText>
				</Section>
			) : null}
			<Section title={`The ${mode} layout needs`}>
				<Facts
					rows={requiredRoles(mode).map((role) => {
						const held = holders(role);
						return [
							role,
							held.length ? `✓ ${held.join(", ")}` : "○ not assigned (m on a partition)",
						];
					})}
				/>
			</Section>
			<Check plan={plan} mode={mode} />
		</Box>
	);
}
