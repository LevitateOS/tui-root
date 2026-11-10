/** The pages: the system as a card, one page a question (a list or a field at the left,
 * a card at the right), the plan to review and apply, and what was recorded. */
import { Box, Text } from "ink";
import { useContext, type ReactNode } from "react";
import {
	Callout,
	Commands,
	ContentWidth,
	Field,
	Heading,
	keyFor,
	SearchField,
	Section,
	textWidth,
	truncateLine,
	truncateLines,
	UiText,
	useIntentColor,
	type PathState,
} from "@levitate/tui-kit";
import type { StepRecord, TargetInfo } from "../domain/recsetup";
import { keyRows } from "../domain/keyboard";
import { localeFormats } from "../domain/locale";
import {
	canLogIn,
	FIELDS,
	listWindow,
	matching,
	options,
	sectionName,
	waitsFor,
	type Failure,
	type FieldId,
	type PageId,
	type Session,
} from "../domain/setup";
import { matchRange, zoneClock, type ZonePlaces } from "../domain/zones";
import type { KeymapFamilies } from "../app/keymaps";
import {
	answerText,
	CommandSheet,
	EmptyCard,
	HostnameCard,
	KeyboardCard,
	LocaleCard,
	MachineCard,
	MarkedField,
	PasswordCard,
	StrengthLine,
	UserCard,
	wrapWords,
	ZoneCard,
	type SheetStep,
} from "./cards";
import type { Prompt } from "./use-setup";
import { CONFIRM_KEYS } from "./keymap";

/** The most rows a question's two columns take: the list and its card. */
export const COLUMN_ROWS = 14;
/** The left column's width: the list, or the field being typed into. */
const LEFT_WIDTH = 34;
const GAP = 2;
/** The least a card needs beside the left column, and the most it spreads to. */
const CARD_MIN = 26;
const CARD_MAX = 56;

function Waiting({ session, page }: { session: Session; page: PageId }): ReactNode {
	return (
		<Callout tone="info" title="Not yet">
			<UiText>Waits for {waitsFor(session, page)}.</UiText>
		</Callout>
	);
}

/** A run that failed: recsetup's message and fix, and the command. */
function FailureCallout({ title, failure }: { title: string; failure: Failure }): ReactNode {
	const { error } = failure;
	return (
		<Box flexDirection="column">
			<Callout tone="danger" title={title}>
				{error ? (
					<UiText>
						{error.message} ({error.code})
					</UiText>
				) : (
					<UiText>{truncateLines(failure.output || "no output", 8)}</UiText>
				)}
				{error?.remediation ? (
					<UiText intent="warning">What to do: {error.remediation}</UiText>
				) : null}
			</Callout>
			<Section title="What ran" trailing={`exit ${failure.exitCode ?? "?"}`}>
				<Commands lines={[failure.argv.join(" ")]} />
			</Section>
		</Box>
	);
}

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** A small count in words, a larger one in digits. */
function countWord(count: number): string {
	return COUNT_WORDS[count] ?? String(count);
}

/** The name of the system as the machine card's corner shows it. */
function systemName(session: Session): string | null {
	return session.inspect.kind === "ok" ? session.inspect.value.target.os_name : null;
}

function MachineOf({ session, numbered }: { session: Session; numbered?: boolean }): ReactNode {
	return (
		<MachineCard
			width={useContext(ContentWidth)}
			answers={session.answers}
			answered={session.answered}
			system={systemName(session)}
			numbered={numbered}
		/>
	);
}

export function OverviewPage({
	session,
	stateError,
}: {
	session: Session;
	stateError: string | null;
}): ReactNode {
	const { target, inspect } = session;
	return (
		<Box flexDirection="column">
			<Heading
				title="Make this machine yours"
				subtitle="Six questions. Nothing changes until you have seen the commands."
			/>
			{stateError ? (
				<Callout tone="warning" title="The install state file can't be read">
					<UiText>{stateError}</UiText>
				</Callout>
			) : null}
			{!target ? (
				<Callout tone="danger" title="No system to configure yet">
					<UiText>
						The disk step says where the new system is mounted, and the base step copies it there.
						Finish them first, or start this app with --target and the path it is mounted at.
					</UiText>
				</Callout>
			) : inspect.kind === "failed" ? (
				<FailureCallout title={`${target.path} can't be configured`} failure={inspect.failure} />
			) : inspect.kind !== "ok" ? null : (
				<MachineOf session={session} />
			)}
		</Box>
	);
}

/** One row of a list: the name with what the search matched picked out, and for a zone
 * its clock. */
function PickRow({
	name,
	filter,
	selected,
	width,
	clock,
}: {
	name: string;
	filter: string;
	selected: boolean;
	width: number;
	clock: string | null;
}): ReactNode {
	const color = useIntentColor();
	const detail = clock ? `${clock} ` : "";
	const room = Math.max(1, width - 1 - textWidth(detail) - 1);
	// A zone's underscores are spaces (New_York); a locale's are part of its name.
	const label = truncateLine(clock ? name.replace(/_/g, " ") : name, room);
	const match = matchRange(label, filter);
	const region = label.lastIndexOf("/") + 1;
	const pad = " ".repeat(Math.max(0, room - textWidth(label) + 1));
	if (selected) {
		// Each part names the bar's colours itself: a nested Text would take the pane's
		// background and leave the place and the time dark on dark.
		const bar = { backgroundColor: color("selectionBackground"), color: color("selection") };
		return (
			<Text {...bar}>
				{" "}
				{label.slice(0, region)}
				<Text bold {...bar}>
					{label.slice(region)}
				</Text>
				{pad}
				{clock ? (
					<Text bold {...bar}>
						{clock}
					</Text>
				) : null}
				{clock ? " " : ""}
			</Text>
		);
	}
	// Each stretch of the name in its own colour: the region quiet, the place plain, and
	// the matched letters in the second accent over both.
	const cuts = [...new Set([0, region, match?.start ?? 0, match?.end ?? 0, label.length])].sort(
		(x, y) => x - y,
	);
	return (
		<Text color={color("text")}>
			{" "}
			{cuts.slice(0, -1).map((from, i) => {
				const matched = match !== null && from >= match.start && from < match.end;
				return (
					<Text
						key={from}
						bold={matched}
						color={color(matched ? "highlight" : from < region ? "dimText" : "text")}
					>
						{label.slice(from, cuts[i + 1])}
					</Text>
				);
			})}
			{pad}
			{clock ? <Text color={color("info")}>{clock}</Text> : null}
			{clock ? <Text color={color("text")}> </Text> : null}
		</Text>
	);
}

/**
 * A question's two columns: what is asked at the left, a card at the right. With too
 * little width for both the card goes under the left column (`stack`) or is left out.
 */
function Columns({
	left,
	card,
	height,
	stack,
}: {
	left: (width: number) => ReactNode;
	card: (width: number, height: number) => ReactNode;
	height: number;
	stack: boolean;
}): ReactNode {
	const width = useContext(ContentWidth);
	const leftWidth = Math.min(LEFT_WIDTH, width);
	const room = width - leftWidth - GAP;
	if (room >= CARD_MIN) {
		return (
			<Box>
				<Box flexDirection="column" width={leftWidth} flexShrink={0}>
					{left(leftWidth)}
				</Box>
				<Box marginLeft={GAP} flexShrink={0}>
					{card(Math.min(room, CARD_MAX), height)}
				</Box>
			</Box>
		);
	}
	if (!stack) return <Box flexDirection="column">{left(width)}</Box>;
	return (
		<Box flexDirection="column">
			{left(leftWidth)}
			<Box marginTop={1}>{card(width, Math.max(9, height - 3))}</Box>
		</Box>
	);
}

/** What to say about the live console's layout, for the line under a field. */
function consoleNote(session: Session): { text: string; intent: "info" | "warning" } | null {
	const live = session.liveKeymap;
	if (live.kind === "ok") return { text: `This console now types ${live.value}.`, intent: "info" };
	if (live.kind === "failed")
		return {
			text: "This console keeps its own layout. The new system gets the one you chose.",
			intent: "warning",
		};
	return null;
}

function PickPage({
	prompt,
	session,
	height,
	places,
	families,
}: {
	prompt: Extract<Prompt, { kind: "pick" }>;
	session: Session;
	height: number;
	places: ZonePlaces;
	families: KeymapFamilies;
}): ReactNode {
	const choices = session.inspect.kind === "ok" ? session.inspect.value.choices : null;
	const all = choices ? options(prompt.field, choices) : [];
	const list = matching(all, prompt.filter);
	const rows = Math.max(1, height - 2);
	const { start, end } = listWindow(list.length, prompt.index, rows);
	const zones = prompt.field === "timezone";
	const now = new Date();
	const selected = list[prompt.index] ?? null;
	const listColumn = (width: number) => (
		<>
			<SearchField
				label="Search"
				text={prompt.filter}
				trailing={`${list.length} of ${all.length}`}
				width={width}
			/>
			<Box flexDirection="column" marginTop={1}>
				{list.length === 0 ? (
					<UiText intent="warning"> Nothing matches.</UiText>
				) : (
					list
						.slice(start, end)
						.map((name, i) => (
							<PickRow
								key={name}
								name={name}
								filter={prompt.filter}
								selected={start + i === prompt.index}
								width={width}
								clock={zones ? (zoneClock(name, now)?.time ?? null) : null}
							/>
						))
				)}
			</Box>
		</>
	);
	const card = (width: number, cardHeight: number) => {
		if (selected === null) return <EmptyCard width={width} height={cardHeight} />;
		if (prompt.field === "keymap") {
			const family = families(selected);
			return (
				<KeyboardCard
					width={width}
					height={cardHeight}
					name={selected}
					family={family}
					rows={keyRows(family)}
					trying={prompt.trying}
				/>
			);
		}
		if (zones)
			return (
				<ZoneCard
					width={width}
					height={cardHeight}
					zone={selected}
					found={prompt.filter.trim() ? list.flatMap((name) => places.get(name) ?? []) : []}
					places={places}
					now={now}
				/>
			);
		return <LocaleOf name={selected} session={session} width={width} height={cardHeight} />;
	};
	return <Columns left={listColumn} card={card} height={height} stack={false} />;
}

function LocaleOf({
	name,
	session,
	width,
	height,
}: {
	name: string;
	session: Session;
	width: number;
	height: number;
}): ReactNode {
	const formats = localeFormats(name, new Date(), session.answers.timezone);
	return formats ? (
		<LocaleCard width={width} height={height} formats={formats} />
	) : (
		<EmptyCard width={width} height={height} />
	);
}

/** The label each question's field wears. */
const FIELD_LABEL: Record<FieldId, string> = {
	keymap: "Keyboard",
	timezone: "Time zone",
	locale: "Language",
	hostname: "Hostname",
	root: "Password",
	user: "User name",
};

/** Each question as the page asks it; the pane's title already names the step. */
const QUESTION: Record<FieldId, { title: string; about: (tool: string) => string }> = {
	keymap: {
		title: "Which keyboard do you type on?",
		about: () => "Tab tries it on this console before you choose.",
	},
	timezone: { title: "Where is this machine?", about: () => "The clock of the new system." },
	locale: {
		title: "Which language?",
		about: () => "The system's language and how it writes dates and numbers.",
	},
	hostname: {
		title: "What is this machine called?",
		about: () => "Its name on the prompt and on the network.",
	},
	root: { title: "A password for root?", about: () => "The system's own administrator account." },
	user: {
		title: "Who uses this machine?",
		about: () => "Your own account. Leave the name empty to create none.",
	},
};

/** The card of a question that is not being asked: its answer, as it would look. */
function AnswerCard({
	field,
	session,
	system,
	families,
	places,
	width,
	height,
}: {
	field: FieldId;
	session: Session;
	system: TargetInfo;
	families: KeymapFamilies;
	places: ZonePlaces;
	width: number;
	height: number;
}): ReactNode {
	const { answers, answered } = session;
	switch (field) {
		case "keymap": {
			if (!answered.keymap || !answers.keymap) return <EmptyCard width={width} height={height} />;
			const family = families(answers.keymap);
			return (
				<KeyboardCard
					width={width}
					height={height}
					name={answers.keymap}
					family={family}
					rows={keyRows(family)}
					trying={null}
				/>
			);
		}
		case "timezone":
			if (!answered.timezone || !answers.timezone)
				return <EmptyCard width={width} height={height} />;
			return (
				<ZoneCard
					width={width}
					height={height}
					zone={answers.timezone}
					found={[]}
					places={places}
					now={new Date()}
				/>
			);
		case "locale":
			if (!answered.locale || !answers.locale) return <EmptyCard width={width} height={height} />;
			return <LocaleOf name={answers.locale} session={session} width={width} height={height} />;
		case "hostname":
			return (
				<HostnameCard
					width={width}
					height={height}
					host={answers.hostname ?? ""}
					user={answers.user}
					refused={false}
				/>
			);
		case "root":
			return (
				<PasswordCard
					width={width}
					height={height}
					who="root"
					name="root"
					tool={system.admin.tool}
				/>
			);
		case "user":
			return (
				<UserCard
					width={width}
					height={height}
					name={answers.user ?? ""}
					tool={system.admin.tool}
					group={system.admin.group}
					shell={system.default_shell}
				/>
			);
	}
}

/** The reason a name was refused, under its field, and what to do about it. */
function Refusal({
	error,
	width,
}: {
	error: { message: string; fix: string | null };
	width: number;
}): ReactNode {
	const lines = [
		...wrapWords(error.message, width),
		...(error.fix ? wrapWords(`What to do: ${error.fix}`, width) : []),
	];
	return (
		<Box flexDirection="column" marginTop={1}>
			{lines.map((line, i) => (
				<UiText key={i} intent="error">
					{line}
				</UiText>
			))}
		</Box>
	);
}

export function FieldPage({
	field,
	session,
	prompt,
	height,
	places,
	families,
}: {
	field: FieldId;
	session: Session;
	prompt: Prompt | null;
	height: number;
	places: ZonePlaces;
	families: KeymapFamilies;
}): ReactNode {
	const system = session.inspect.kind === "ok" ? session.inspect.value.target : null;
	const asking =
		prompt !== null &&
		((prompt.kind === "pick" && prompt.field === field) ||
			(prompt.kind === "text" && prompt.field === field) ||
			(prompt.kind === "password" && prompt.who === field) ||
			(prompt.kind === "autologin" && field === "user"));
	const password = asking && prompt.kind === "password" ? prompt : null;
	const autologin = asking && prompt.kind === "autologin" ? prompt : null;
	const title = autologin
		? `Log ${autologin.name} in by itself?`
		: password && password.who === "user"
			? `A password for ${password.name}?`
			: null;
	const about = QUESTION[field].about(system?.admin.tool ?? "the admin tool");
	const heading = (
		<Heading
			step={FIELDS.indexOf(field) + 1}
			title={title ?? QUESTION[field].title}
			subtitle={
				autologin
					? "At every start the desktop opens without the login screen."
					: password && password.who === "user"
						? `What ${password.name} logs in with, and ${system?.admin.tool ?? "the admin tool"} asks for.`
						: about
			}
		/>
	);
	if (!system) {
		return (
			<Box flexDirection="column">
				{heading}
				<Waiting session={session} page={field} />
			</Box>
		);
	}
	const answered = session.answered[field];
	let body: ReactNode;
	if (!asking) {
		body = (
			<Columns
				height={height}
				stack
				left={(width) => {
					const note = field === "keymap" ? consoleNote(session) : null;
					return (
						<>
							<Field
								label={FIELD_LABEL[field]}
								text={
									answered ? answerText(field, session.answers, true, true) : "not answered yet"
								}
								width={width}
								cursor={false}
							/>
							{note ? (
								<Box marginTop={1} flexDirection="column">
									{wrapWords(note.text, width).map((line, i) => (
										<UiText key={i} intent={note.intent}>
											{line}
										</UiText>
									))}
								</Box>
							) : null}
						</>
					);
				}}
				card={(width, cardHeight) => (
					<AnswerCard
						field={field}
						session={session}
						system={system}
						families={families}
						places={places}
						width={width}
						height={cardHeight}
					/>
				)}
			/>
		);
	} else if (prompt.kind === "pick") {
		body = (
			<PickPage
				prompt={prompt}
				session={session}
				height={height}
				places={places}
				families={families}
			/>
		);
	} else if (prompt.kind === "text") {
		const typed = prompt.text.trim();
		const hostname = prompt.field === "hostname";
		body = (
			<Columns
				height={height}
				stack
				left={(width) => (
					<>
						<MarkedField
							label={hostname ? "Hostname" : "User name"}
							text={prompt.text}
							width={width}
							at={prompt.error?.at ?? null}
						/>
						{prompt.checking ? (
							<Box marginTop={1}>
								<UiText intent="warning">Asking recsetup…</UiText>
							</Box>
						) : null}
						{prompt.error ? <Refusal error={prompt.error} width={width} /> : null}
					</>
				)}
				card={(width, cardHeight) =>
					hostname ? (
						<HostnameCard
							width={width}
							height={cardHeight}
							host={typed}
							user={session.answers.user}
							refused={prompt.error !== null}
						/>
					) : (
						<UserCard
							width={width}
							height={cardHeight}
							name={typed}
							tool={system.admin.tool}
							group={system.admin.group}
							shell={system.default_shell}
						/>
					)
				}
			/>
		);
	} else if (prompt.kind === "autologin") {
		body = (
			<Columns
				height={height}
				stack
				left={(width) => (
					<>
						{wrapWords(
							`With yes, ${prompt.name}'s desktop opens at every start without asking for the password: anyone at the machine gets it. The password still unlocks the screen and ${system.admin.tool}.`,
							width,
						).map((line, i) => (
							<UiText key={i}>{line}</UiText>
						))}
						<Box marginTop={1}>
							<UiText intent="faintText">
								y: log in by itself · n: ask at the login screen (the default)
							</UiText>
						</Box>
					</>
				)}
				card={(width, cardHeight) => (
					<UserCard
						width={width}
						height={cardHeight}
						name={prompt.name}
						tool={system.admin.tool}
						group={system.admin.group}
						shell={system.default_shell}
					/>
				)}
			/>
		);
	} else if (prompt.kind === "password") {
		const first = prompt.first === null;
		const live = session.liveKeymap;
		body = (
			<Columns
				height={height}
				stack
				left={(width) => (
					<>
						<Field
							label="Password "
							text={first ? prompt.text : (prompt.first ?? "")}
							width={width}
							secret
							cursor={first}
						/>
						<StrengthLine
							length={[...(first ? prompt.text : (prompt.first ?? ""))].length}
							width={width}
						/>
						<Box marginTop={1} flexDirection="column">
							<Field
								label="Once more"
								text={first ? "" : prompt.text}
								width={width}
								secret
								cursor={!first}
							/>
						</Box>
						<Box marginTop={1} flexDirection="column">
							{prompt.error
								? wrapWords(prompt.error, width).map((line, i) => (
										<UiText key={i} intent="error">
											{line}
										</UiText>
									))
								: null}
							{live.kind !== "idle" ? (
								<UiText intent="faintText">
									{live.kind === "ok"
										? `Typed on the ${live.value} keyboard.`
										: "Typed on this console's own layout."}
								</UiText>
							) : null}
						</Box>
					</>
				)}
				card={(width, cardHeight) => (
					<PasswordCard
						width={width}
						height={cardHeight}
						who={prompt.who}
						name={prompt.name}
						tool={system.admin.tool}
					/>
				)}
			/>
		);
	}
	return (
		<Box flexDirection="column">
			{heading}
			{field === "timezone" && !system.has_zoneinfo ? (
				<Callout tone="warning" title="Only UTC">
					<UiText>The system has no time zone database, so UTC is the one zone it knows.</UiText>
				</Callout>
			) : null}
			{body}
		</Box>
	);
}

const RECORD_STATE: Record<StepRecord["status"], PathState> = {
	planned: "waiting",
	done: "done",
	failed: "failed",
	not_run: "waiting",
};

/** The plan's commands as a sheet, every one with the state given for its step. */
function PlanSheet({
	steps,
	state,
	compact = false,
}: {
	steps: readonly { section: string; command: string }[];
	state: (index: number) => PathState;
	compact?: boolean;
}): ReactNode {
	const sheet: SheetStep[] = steps.map((step, i) => ({
		phase: sectionName(step.section),
		command: step.command,
		state: state(i),
	}));
	return <CommandSheet steps={sheet} width={useContext(ContentWidth)} compact={compact} />;
}

export type ReviewView = "answers" | "commands";

export function ReviewPage({
	session,
	prompt,
	view,
}: {
	session: Session;
	prompt: Prompt | null;
	view: ReviewView;
}): ReactNode {
	const { answers, plan, apply, target } = session;
	const width = useContext(ContentWidth);
	const heading = (subtitle: string) => (
		<Heading step={FIELDS.length + 1} title="Is this right?" subtitle={subtitle} />
	);
	const waiting = waitsFor(session, "review");
	if (waiting) {
		return (
			<Box flexDirection="column">
				{heading("Nothing has changed yet.")}
				<Waiting session={session} page="review" />
			</Box>
		);
	}
	if (apply.kind === "failed") {
		const records = apply.result?.steps ?? null;
		const failedAt = records?.findIndex((record) => record.status === "failed") ?? -1;
		const failed = failedAt >= 0 ? records![failedAt]! : null;
		if (!records || !failed) {
			return (
				<Box flexDirection="column">
					<Heading glyph="bang" tone="error" title="The configuration stopped" />
					<FailureCallout title="recsetup could not finish" failure={apply.failure} />
				</Box>
			);
		}
		const text = failed.stderr?.trim() || apply.failure.error?.message || "";
		const fix = apply.failure.error?.remediation;
		return (
			<Box flexDirection="column">
				<Heading
					glyph="bang"
					tone="error"
					title="The configuration stopped"
					subtitle={`At command ${failedAt + 1} of ${records.length}.`}
				/>
				<PlanSheet steps={records} state={(i) => RECORD_STATE[records[i]!.status]} compact />
				<Box flexDirection="column" marginTop={1}>
					{text ? <UiText intent="error">{truncateLines(text, 4)}</UiText> : null}
					{fix ? (
						<UiText intent="warning">{wrapWords(`What to do: ${fix}`, width).join("\n")}</UiText>
					) : null}
					{failedAt > 0 ? (
						<UiText intent="info">The {countWord(failedAt)} commands before it are done.</UiText>
					) : null}
				</Box>
			</Box>
		);
	}
	const planned = plan.kind === "ok" ? plan.value : null;
	const insideTarget = planned?.steps.every((step) => step.command.startsWith("recchroot "));
	const subtitle =
		view === "commands" && planned
			? `Nothing has changed yet. ${planned.steps.length} commands${insideTarget ? ", each inside the new system" : ""}.`
			: apply.kind === "ok"
				? "Every command ran."
				: apply.kind === "running"
					? `Applying to ${target?.path}.`
					: "Nothing has changed yet.";
	const asking = prompt?.kind === "apply";
	return (
		<Box flexDirection="column">
			{heading(subtitle)}
			{asking ? (
				<Callout
					tone="warning"
					title={`Apply these ${countWord(FIELDS.length)} answers to ${target?.path}?`}
					keys={[
						[keyFor(CONFIRM_KEYS, "yes"), "apply"],
						["n", "not yet"],
					]}
				/>
			) : null}
			{planned?.warnings.map((warning) => (
				<Callout key={warning} tone="warning" title="Check this first">
					<UiText>{warning}</UiText>
				</Callout>
			))}
			{!canLogIn(answers) ? (
				<Callout tone="danger" title="Nobody could log in">
					<UiText>
						Root has no password and no user is created. Set a root password or create a user before
						applying.
					</UiText>
				</Callout>
			) : null}
			{plan.kind === "failed" ? (
				<FailureCallout title="recsetup refuses these answers" failure={plan.failure} />
			) : view === "commands" || apply.kind === "running" ? (
				planned ? (
					<PlanSheet
						steps={planned.steps}
						state={() => (apply.kind === "running" ? "running" : "waiting")}
					/>
				) : (
					<UiText intent="warning">Working out the commands…</UiText>
				)
			) : (
				<MachineOf session={session} numbered={!asking} />
			)}
		</Box>
	);
}

export function DonePage({ session }: { session: Session }): ReactNode {
	const { saved, apply } = session;
	if (!saved || apply.kind !== "ok") {
		return (
			<Box flexDirection="column">
				<Heading title="Done" />
				<Waiting session={session} page="done" />
			</Box>
		);
	}
	return (
		<Box flexDirection="column">
			<Heading
				glyph="check"
				tone="success"
				title="This machine is yours"
				subtitle="It knows its keyboard, clock, language and name, and who may log in."
			/>
			{saved.kind === "failed" ? (
				<Callout tone="warning" title="The step isn't recorded">
					<UiText>
						The system is configured, but {saved.path} couldn't be updated: {saved.message}. The
						install steps won't know this step is done.
					</UiText>
				</Callout>
			) : null}
			<MachineOf session={session} />
		</Box>
	);
}
