/** The partition editor page: the disk as the edits leave it with the selected stretch
 * marked, its table with the selected row as a bar, and what the system still needs
 * beside it. The row's actions are in the footer's keys. */
import { Box, Text } from "ink";
import { useContext, type ReactNode } from "react";
import {
	Callout,
	ContentWidth,
	DiskBar,
	formatBytes,
	Heading,
	Section,
	shortDevice,
	Table,
	UiText,
	useIntentColor,
	type ColorIntent,
	type Tone,
} from "@levitate/tui-kit";
import type { InspectResult, InstallMode, PartitionPlan } from "../generated/recpart";
import type { Run } from "../flow";
import { describeSignature } from "../domain/recpart";
import { MIB, requiredRoles, type Segment } from "../domain/layout";
import { neededMb, roleLabel, ROLE_PURPOSE, SETUP_NAME } from "../domain/setup";
import { sizeAnswer, type PartitionEditor, type Prompt } from "./use-partition-editor";
import { StepNumber } from "./pages";
import { Needs, Runs, segmentParts, type Need } from "./pictures";

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

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
	return shortDevice(segment.part.device);
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

/** The question being asked, with what an answer may be. */
function PromptBox({ editor }: { editor: PartitionEditor }): ReactNode {
	const color = useIntentColor();
	const raised = color("raisedBackground");
	const prompt = editor.prompt;
	if (!prompt) return null;
	if (prompt.kind === "choice") {
		const labelWidth = Math.max(...prompt.options.map((o) => o.label.length)) + 4;
		return (
			<Callout tone="info" title={prompt.title}>
				{prompt.options.map((option, i) => (
					<Box key={option.label} flexDirection="row">
						<Box width={labelWidth} flexShrink={0}>
							<Text
								bold={i === prompt.index}
								color={color(i === prompt.index ? "accent" : "text")}
								backgroundColor={raised}
							>
								{i === prompt.index ? "▸ " : "  "}
								{option.label}
							</Text>
						</Box>
						<Box flexGrow={1} flexShrink={1}>
							<Text color={color("dimText")} backgroundColor={raised}>
								{option.help ?? ""}
							</Text>
						</Box>
					</Box>
				))}
				<UiText intent="dimText">↑/↓ choose · Enter accept · Esc cancel</UiText>
			</Callout>
		);
	}
	if (prompt.kind === "room") return <RoomSlider prompt={prompt} />;
	const answer = prompt.kind === "size" ? sizeAnswer(prompt) : null;
	return (
		<Callout tone="info" title={prompt.title}>
			<Runs
				runs={[
					["› ", "dimText"],
					[prompt.text, "text", true],
					["_", "dimText"],
					...(answer
						? ([
								[
									answer.kind === "ok"
										? `   = ${formatBytes(answer.mb * MIB)}`
										: `   ${answer.message}`,
									answer.kind === "ok" ? "success" : "warning",
								],
							] as const)
						: []),
				]}
			/>
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
	const room = prompt.maxMb - prompt.sizeMb;
	const cells = (mb: number) => Math.round((mb / Math.max(1, prompt.maxMb)) * (width - 1));
	const keep = Math.max(1, cells(prompt.sizeMb));
	const used = Math.min(keep, prompt.usedMb === null ? 0 : Math.max(1, cells(prompt.usedMb)));
	const left = `${prompt.name}: ${formatBytes(prompt.sizeMb * MIB)}`;
	const right = `for the new system: ${formatBytes(room * MIB)}`;
	const gap = Math.max(1, width - left.length - right.length);
	const roomTone: ColorIntent = room < prompt.needMb ? "warning" : "success";
	return (
		<Callout tone="info" title={prompt.title}>
			<UiText>Its files stay where they are; only space it doesn't use is given up.</UiText>
			<Box marginTop={1} flexDirection="column">
				<Runs
					runs={[
						["█".repeat(used), "accent"],
						["▒".repeat(keep - used), "accent"],
						["│", "text", true],
						["·".repeat(Math.max(0, width - 1 - keep)), "success"],
					]}
				/>
				{left.length + right.length + 1 <= width ? (
					<Runs
						runs={[
							[left, "text", true],
							[" ".repeat(gap), "text"],
							[right, roomTone, true],
						]}
					/>
				) : (
					<>
						<Runs runs={[[left, "text", true]]} />
						<Runs runs={[[right, roomTone, true]]} />
					</>
				)}
			</Box>
			{prompt.text ? (
				<Runs
					runs={[
						["room › ", "dimText"],
						[prompt.text, "text", true],
						["_", "dimText"],
					]}
				/>
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

const TONE_INTENT: Record<Tone, ColorIntent> = {
	danger: "error",
	warning: "warning",
	success: "success",
	info: "info",
};

/** The one next step: make room, fill the free space, fix what recpart refuses, or go on. */
function guide(editor: PartitionEditor, mode: InstallMode, plan: Run<PartitionPlan>): Guide {
	const name = SETUP_NAME[mode];
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
					<Runs
						key={step.what}
						runs={[
							["• ", "text"],
							[step.what, "text", true],
							[`: ${step.detail}`, "text"],
						]}
					/>
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
				`There isn't ${need} of free space in one place, which ${SETUP_NAME[mode]} needs.`,
				<Runs
					key="s"
					runs={[
						["s shrinks ", "text"],
						[`${shortDevice(shrink.part.device)}${label ? ` ("${label}")` : ""}`, "text", true],
						[
							` without touching its files: it can give up to ${formatBytes(shrink.spareMb * MIB)}. You choose how much with ← and →.`,
							"text",
						],
					]}
				/>,
			],
		};
	}
	// Nothing can shrink: say why for the partitions big enough to have helped, then what
	// is left to do.
	const stuck = (editor.projection?.segments ?? []).flatMap((s) =>
		s.kind === "existing" && s.edit.op === "keep" && s.part.resize_blocker ? [s.part] : [],
	);
	const big = stuck.filter((part) => part.size_bytes >= neededMb(mode) * MIB);
	const root = stuck.find((part) => part.mountpoints.includes("/"));
	return {
		tone: "warning",
		title: "No partition here can be made smaller",
		lines: [
			`${capital(SETUP_NAME[mode])} needs ${need} of free space, and there is none.`,
			...(big.length ? big : stuck).map((part) => (
				<Runs
					key={part.device}
					runs={[
						["• ", "text"],
						[shortDevice(part.device), "text", true],
						[
							` (${[part.filesystem, formatBytes(part.size_bytes), part.used_bytes !== null ? `${formatBytes(part.used_bytes)} used` : null].filter(Boolean).join(", ")}): ${part.resize_blocker!.split("; ")[0]}`,
							"text",
						],
					]}
				/>
			)),
			...(root
				? [
						<UiText key="root" intent="dimText">
							{`This disk holds the system running now (/ is ${shortDevice(root.device)}), so its partitions are in use. From the live ISO they aren't, but XFS still can't shrink.`}
						</UiText>,
					]
				: []),
			<Runs
				key="do"
				runs={[
					["What you can do: ", "text", true],
					[
						"delete a partition you don't need (select it, d; what is on it is lost), install on another disk, or go back (p) and erase this one.",
						"text",
					],
				]}
			/>,
		],
	};
}

/** What the selected row is, as one line. */
function selectedLine(segment: Segment): string {
	if (segment.kind === "free") return `${formatBytes(segment.size)} of free space`;
	if (segment.kind === "new")
		return `A new ${formatBytes(segment.size)} partition${segment.role ? `: ${roleLabel(segment.role, segment.mountpoint)}` : ""}`;
	const part = segment.part;
	const label = part.fs_label ?? part.label;
	return [
		`${shortDevice(part.device)}: ${formatBytes(part.size_bytes)} now`,
		part.filesystem ?? "no filesystem",
		label ? `"${label}"` : null,
		part.used_bytes !== null ? `${formatBytes(part.used_bytes)} used` : null,
		part.mountpoints.length ? `mounted at ${part.mountpoints.join(", ")}` : null,
	]
		.filter(Boolean)
		.join(" · ");
}

/** What the Used as column says: the short name of the role. */
function used(segment: Segment): string {
	if (segment.kind === "free" || !segment.role) return "";
	return ROLE_SHORT[segment.role] ?? roleLabel(segment.role, segment.mountpoint);
}

/** The width the needs take beside the table, and the least the table keeps. */
const NEEDS_WIDTH = 23;
const TABLE_MIN = 41;

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
	const step = useContext(StepNumber);
	const full = useContext(ContentWidth);
	const color = useIntentColor();
	const heading = (subtitle: ReactNode) => (
		<Heading title="Place the new system" subtitle={subtitle} step={step} />
	);
	if (inspect.kind === "failed")
		return (
			<Box flexDirection="column">
				{heading("Nothing is written until the Confirm step.")}
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
				{heading("Nothing is written until the Confirm step.")}
				<UiText intent="dimText">Reading the disk with recpart inspect …</UiText>
			</Box>
		);
	const next = guide(editor, mode, plan);
	const segment = projection.segments[editor.selected];
	const held = (role: string): Segment | undefined =>
		projection.segments.find((s) => s.kind !== "free" && s.role === role);
	const needs: Need[] = requiredRoles(mode).map((role) => {
		const holder = held(role);
		return {
			name: ROLE_SHORT[role] ?? role,
			got: !holder
				? "not yet"
				: holder.kind === "new"
					? formatBytes(holder.size)
					: change(holder).text,
			met: holder !== undefined,
		};
	});
	const beside = full >= TABLE_MIN + NEEDS_WIDTH + 2;
	const needsTitle = `${SETUP_NAME[mode] === "A/B" ? "A/B" : "The system"} needs`;
	const table = (
		<ContentWidth.Provider value={beside ? full - NEEDS_WIDTH - 2 : full}>
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
					used(s),
					change(s).text,
				])}
			/>
		</ContentWidth.Provider>
	);
	return (
		<Box flexDirection="column">
			{heading(
				editor.prompt ? (
					"Answer below; Esc cancels. Nothing is written until the Confirm step."
				) : (
					<Text color={color(TONE_INTENT[next.tone])}>{next.title}</Text>
				),
			)}
			<PromptBox editor={editor} />
			<DiskBar parts={segmentParts(projection)} selected={editor.selected} />
			{beside ? (
				<Box flexDirection="row">
					{table}
					<Box width={2} flexShrink={0} />
					<Needs title={needsTitle} needs={needs} width={NEEDS_WIDTH} />
				</Box>
			) : (
				<>
					{table}
					<Box marginTop={1}>
						<Needs title={needsTitle} needs={needs} width={full} />
					</Box>
				</>
			)}
			<Box marginTop={1} flexDirection="column">
				{editor.prompt
					? null
					: next.lines.map((line, i) =>
							typeof line === "string" ? <UiText key={i}>{line}</UiText> : line,
						)}
				{segment && !editor.prompt ? (
					<UiText intent="dimText">{selectedLine(segment)}</UiText>
				) : null}
				{segment?.kind === "existing" && segment.edit.op !== "keep" ? (
					<UiText intent="warning">
						{segment.edit.op === "resize"
							? `Change: ${change(segment).text} to ${formatBytes(segment.size)}`
							: `Change: ${change(segment).text}`}
					</UiText>
				) : null}
				{segment?.kind === "existing" && segment.part.resize_blocker ? (
					<UiText intent="dimText">{`Can't be made smaller: ${segment.part.resize_blocker}.`}</UiText>
				) : null}
				{segment && segment.kind !== "free" && segment.role ? (
					<UiText intent="dimText">{`Used as ${roleLabel(segment.role, segment.mountpoint)}: ${ROLE_PURPOSE[segment.role]}`}</UiText>
				) : null}
				{editor.prompt ? null : (
					<UiText intent="faintText">
						Also: x leaves a partition as it is, W makes a new table, U undoes everything, p goes
						back.
					</UiText>
				)}
				{editor.notice ? <UiText intent="warning">{editor.notice}</UiText> : null}
			</Box>
			{projection.erased.length || (editor.edits.newTable && inspect.value.signatures?.length) ? (
				<Box marginTop={1} flexDirection="column">
					<Section title="Erased" trailing={`${projection.erased.length}`}>
						<UiText intent="error">
							{[
								...projection.erased.map(
									(p) =>
										`${shortDevice(p.device)} ${formatBytes(p.size_bytes)}${p.filesystem ? ` ${p.filesystem}` : ""}`,
								),
								...(editor.edits.newTable
									? (inspect.value.signatures ?? []).map(
											(sig) => `${describeSignature(sig)} on the whole disk`,
										)
									: []),
							].join(" · ")}
						</UiText>
					</Section>
				</Box>
			) : null}
		</Box>
	);
}

/** Short names for what the layout needs. */
const ROLE_SHORT: Partial<Record<string, string>> = {
	efi: "EFI",
	root: "System",
	root_a: "Slot A",
	root_b: "Slot B",
	state: "State",
};
