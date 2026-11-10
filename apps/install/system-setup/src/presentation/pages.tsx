/** The pages: the system being configured, one page a question, the plan to review and
 * apply, and what was recorded. */
import { Box, Text } from "ink";
import { useContext, type ReactNode } from "react";
import {
	keyFor,
	Callout,
	Commands,
	ContentWidth,
	Facts,
	Heading,
	SearchField,
	Section,
	StepList,
	textWidth,
	truncateLine,
	truncateLines,
	UiText,
	useIntentColor,
	type StepStatus,
} from "@levitate/tui-kit";
import { statePath, type Then } from "@levitate/install-state";
import { guideSteps, guideTitle, STEP_INFO } from "@levitate/docs-content/install";
import type { StepRecord, TargetInfo } from "../domain/recsetup";
import {
	canLogIn,
	FIELDS,
	listWindow,
	matching,
	options,
	pageState,
	PAGES,
	sectionName,
	waitsFor,
	type Answers,
	type Failure,
	type FieldId,
	type PageId,
	type PickField,
	type Session,
} from "../domain/setup";
import {
	matchRange,
	worldMap,
	zoneClock,
	zoneParts,
	type ZoneClock,
	type ZonePlaces,
} from "../domain/zones";
import type { Prompt } from "./use-setup";
import { CONFIRM_KEYS, MAIN_KEYS, PICK_KEYS, TEXT_KEYS } from "./keymap";

function Hint({ children }: { children: ReactNode }): ReactNode {
	return <UiText intent="dimText">{children}</UiText>;
}

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

const STEP_OF: Record<string, StepStatus> = {
	done: "ok",
	running: "running",
	failed: "failed",
	ready: "planned",
	waiting: "planned",
};

/** An answer as the pages show it; passwords only as set or not. */
function shown(field: FieldId, answers: Answers, answered: boolean): string {
	if (!answered) return "not answered yet";
	switch (field) {
		case "root":
			return answers.rootPassword === null ? "none (root can't log in)" : "set";
		case "user":
			return answers.user === null ? "none" : `${answers.user}, an administrator`;
		default:
			return answers[field] ?? "left as the system has it";
	}
}

/** What each question sets, in a line. */
function about(field: FieldId, system: TargetInfo | null): string {
	const tool = system?.admin.tool ?? "the admin tool";
	switch (field) {
		case "keymap":
			return "Loaded on this console at once, so your passwords come out the same after the reboot.";
		case "timezone":
			return "The clock of the new system.";
		case "locale":
			return "The system's language and formats.";
		case "hostname":
			return "Its name on the prompt and on the network.";
		case "root":
			return `Leave it empty and root gets none: only your own user administers the system, with ${tool}.`;
		case "user":
			return `Your own account, an administrator (${tool}). Leave the name empty to create none.`;
	}
}

/** Each question as the page asks it; the pane's title already names the step. */
const QUESTION: Record<FieldId, string> = {
	keymap: "Which keyboard do you type on?",
	timezone: "Where is this machine?",
	locale: "Which language?",
	hostname: "What is this machine called?",
	root: "A password for root?",
	user: "Who uses this machine?",
};

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
				title="Configure the new system"
				subtitle={`Install ${guideSteps("installation-config")}: ${STEP_INFO.setup.about} Nothing changes until you have reviewed the commands.`}
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
				<Box flexDirection="column">
					<FailureCallout title={`${target.path} can't be configured`} failure={inspect.failure} />
					<Hint>{keyFor(MAIN_KEYS, "go")} reads it again once that is fixed.</Hint>
				</Box>
			) : inspect.kind !== "ok" ? (
				<UiText intent="warning">Reading the system at {target.path}…</UiText>
			) : (
				<Section title="System">
					<Facts
						rows={[
							["System", inspect.value.target.os_name],
							["Mounted at", inspect.value.target.root],
							[
								"Administrators",
								`members of ${inspect.value.target.admin.group}, with ${inspect.value.target.admin.tool}`,
							],
						]}
					/>
				</Section>
			)}
			<Section title="What you choose">
				<StepList
					steps={[
						...FIELDS.map((field) => ({
							phase: "",
							command: `${PAGES[field].title}: ${shown(field, session.answers, session.answered[field])}`,
							status: STEP_OF[pageState(session, field)]!,
						})),
						{
							phase: "",
							command: "Review the commands, then apply them (recsetup)",
							status: STEP_OF[pageState(session, "review")]!,
						},
					]}
				/>
			</Section>
			{inspect.kind === "ok" ? (
				<Hint>{keyFor(MAIN_KEYS, "go")} goes to the question the step is at.</Hint>
			) : null}
		</Box>
	);
}

/** What is being typed, with a cursor; a password shows as dots. */
function Entry({
	label,
	text,
	secret,
}: {
	label: string;
	text: string;
	secret?: boolean;
}): ReactNode {
	const color = useIntentColor();
	return (
		<Text>
			<Text color={color("dimText")}>{label} </Text>
			<Text bold color={color("text")}>
				{secret ? "•".repeat([...text].length) : text}
			</Text>
			<Text backgroundColor={color("accent")}> </Text>
		</Text>
	);
}

/** A list's widest, so a short list does not stretch across a wide pane. */
const LIST_WIDTH = 40;
/** The least a zone card needs beside the list. */
const CARD_MIN_WIDTH = 26;
const CARD_GAP = 2;

/** One row: the name with what the search matched picked out, and for a zone its clock. */
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
	clock: ZoneClock | null;
}): ReactNode {
	const color = useIntentColor();
	const detail = clock ? `${clock.time}  ${clock.offset} ` : "";
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
						{clock.time}
					</Text>
				) : null}
				{clock ? `  ${clock.offset} ` : ""}
			</Text>
		);
	}
	// Each stretch of the name in its own colour: the region quiet, the place plain, and
	// the matched letters in the second accent over both.
	const cuts = [...new Set([0, region, match?.start ?? 0, match?.end ?? 0, label.length])].sort(
		(x, y) => x - y,
	);
	return (
		<Text>
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
			{clock ? <Text color={color("info")}>{clock.time}</Text> : null}
			{clock ? <Text color={color("navHeading")}>{`  ${clock.offset} `}</Text> : null}
		</Text>
	);
}

/** The selected zone: its name, where it is on the map with the zones the search found,
 * and its clock. */
function ZoneCard({
	zone,
	found,
	places,
	now,
	width,
	mapRows,
}: {
	zone: string;
	found: readonly string[];
	places: ZonePlaces;
	now: Date;
	width: number;
	mapRows: number;
}): ReactNode {
	const color = useIntentColor();
	const inner = Math.max(1, width - 4);
	const place = places.get(zone) ?? null;
	const clock = zoneClock(zone, now);
	const { region, city } = zoneParts(zone);
	const tag = clock?.abbreviation ? ` ${clock.abbreviation} ` : "";
	const title = truncateLine(city, Math.max(1, inner - textWidth(tag) - 1));
	const where = [place?.country, region.replace(/\/$/, "").replace(/_/g, " ")].filter(Boolean);
	const map = worldMap(
		inner,
		mapRows,
		place,
		found.flatMap((name) => places.get(name) ?? []),
	);
	// Land stands clear of the card; the zones a search found and the pin stand clear of it.
	const KIND = { sea: "navBorder", land: "dimText", lit: "accent", pin: "highlight" } as const;
	const fact = (label: string, value: string, bold = false) => (
		<Text>
			<Text color={color("dimText")}>{label}</Text>
			{" ".repeat(Math.max(1, inner - textWidth(label) - textWidth(value)))}
			<Text bold={bold} color={color("text")}>
				{value}
			</Text>
		</Text>
	);
	return (
		<Box
			flexDirection="column"
			width={width}
			flexShrink={0}
			paddingX={2}
			paddingY={1}
			backgroundColor={color("panelBackground")}
		>
			<Text>
				<Text bold color={color("text")}>
					{title}
				</Text>
				{" ".repeat(Math.max(1, inner - textWidth(title) - textWidth(tag)))}
				<Text bold color={color("selection")} backgroundColor={color("accent")}>
					{tag}
				</Text>
			</Text>
			<Text color={color("dimText")}>{truncateLine(where.join(", ") || " ", inner)}</Text>
			<Box flexDirection="column" marginY={1}>
				{map.map((line, row) => (
					<Text key={row}>
						{line.map((cell, column) => (
							<Text
								key={column}
								bold={cell.kind === "pin" || cell.kind === "lit"}
								color={color(KIND[cell.kind])}
							>
								{cell.text}
							</Text>
						))}
					</Text>
				))}
			</Box>
			{clock ? fact("Local time", clock.time, true) : null}
			{clock ? fact("From UTC", clock.offset) : null}
		</Box>
	);
}

const SEARCH_LABEL: Record<PickField, string> = {
	keymap: "Search",
	timezone: "Search",
	locale: "Search",
};

function PickList({
	prompt,
	all,
	rows,
	places,
}: {
	prompt: Extract<Prompt, { kind: "pick" }>;
	all: readonly string[];
	rows: number;
	places: ZonePlaces;
}): ReactNode {
	const width = useContext(ContentWidth);
	const list = matching(all, prompt.filter);
	const { start, end } = listWindow(list.length, prompt.index, rows);
	const zones = prompt.field === "timezone";
	const now = new Date();
	// Beside the zones, a card for the selected one when the pane has the room.
	const card = zones && width >= LIST_WIDTH + CARD_GAP + CARD_MIN_WIDTH && list.length > 0;
	const listWidth = card || width > LIST_WIDTH ? Math.min(LIST_WIDTH, width) : width;
	const cardWidth = Math.min(40, width - listWidth - CARD_GAP);
	const selected = list[prompt.index];
	const below = list.length - end;
	return (
		<Box>
			<Box flexDirection="column" width={listWidth} flexShrink={0}>
				<SearchField
					label={SEARCH_LABEL[prompt.field]}
					text={prompt.filter}
					trailing={`${list.length} of ${all.length}`}
					width={listWidth}
				/>
				<Box flexDirection="column" marginTop={1}>
					{list.length === 0 ? (
						<UiText intent="warning">
							Nothing matches. {keyFor(PICK_KEYS, "erase")} erases what you typed.
						</UiText>
					) : (
						list
							.slice(start, end)
							.map((name, i) => (
								<PickRow
									key={name}
									name={name}
									filter={prompt.filter}
									selected={start + i === prompt.index}
									width={listWidth}
									clock={zones ? zoneClock(name, now) : null}
								/>
							))
					)}
					{start > 0 || below > 0 ? (
						<UiText intent="navHeading">
							{" "}
							{[start > 0 ? `${start} above` : null, below > 0 ? `${below} more below` : null]
								.filter(Boolean)
								.join(", ")}
						</UiText>
					) : null}
				</Box>
			</Box>
			{card && selected ? (
				<Box marginLeft={CARD_GAP}>
					<ZoneCard
						zone={selected}
						found={prompt.filter.trim() ? list : []}
						places={places}
						now={now}
						width={cardWidth}
						mapRows={Math.max(4, Math.min(10, rows - 5))}
					/>
				</Box>
			) : null}
		</Box>
	);
}

/** The live console's keymap, once the keyboard is chosen. */
function LiveKeymap({ session }: { session: Session }): ReactNode {
	const live = session.liveKeymap;
	if (live.kind === "ok")
		return (
			<Callout tone="success" title={`This console now types ${live.value}`}>
				<UiText>What you type from here on, the passwords too, uses this layout.</UiText>
			</Callout>
		);
	if (live.kind === "failed")
		return (
			<Callout tone="warning" title="This console keeps its own layout">
				<UiText>
					The new system gets the layout you chose, but it could not be loaded here (
					{live.failure.argv.join(" ")}: exit {live.failure.exitCode ?? "?"}). On a serial line or
					over SSH the layout is your terminal's. Type the passwords with care: they are set as this
					console sends them.
				</UiText>
			</Callout>
		);
	return null;
}

export function FieldPage({
	field,
	session,
	prompt,
	listRows,
	places,
}: {
	field: FieldId;
	session: Session;
	prompt: Prompt | null;
	listRows: number;
	places: ZonePlaces;
}): ReactNode {
	const system = session.inspect.kind === "ok" ? session.inspect.value : null;
	const heading = (
		<Heading
			step={FIELDS.indexOf(field) + 1}
			title={QUESTION[field]}
			subtitle={about(field, system?.target ?? null)}
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
	const asking =
		prompt !== null &&
		((prompt.kind === "pick" && prompt.field === field) ||
			(prompt.kind === "text" && prompt.field === field) ||
			(prompt.kind === "password" && prompt.who === field));
	return (
		<Box flexDirection="column">
			{heading}
			{field === "timezone" && !system.target.has_zoneinfo ? (
				<Callout tone="warning" title="Only UTC">
					<UiText>The system has no time zone database, so UTC is the one zone it knows.</UiText>
				</Callout>
			) : null}
			{!asking ? (
				<Box flexDirection="column">
					<Section title="Answer">
						<Facts rows={[[PAGES[field].title, shown(field, session.answers, answered)]]} />
					</Section>
					{field === "keymap" ? <LiveKeymap session={session} /> : null}
					<Hint>
						{keyFor(MAIN_KEYS, "go")} {answered ? "changes it" : "answers it"}.
					</Hint>
				</Box>
			) : prompt.kind === "pick" ? (
				<PickList
					prompt={prompt}
					all={options(prompt.field, system.choices)}
					rows={listRows}
					places={places}
				/>
			) : prompt.kind === "text" ? (
				<Section title={prompt.field === "hostname" ? "Name the machine" : "Name the user"}>
					<Entry
						label={prompt.field === "hostname" ? "Hostname:" : "User name:"}
						text={prompt.text}
					/>
					{prompt.checking ? <UiText intent="warning">Asking recsetup…</UiText> : null}
					{prompt.error ? (
						<Box flexDirection="column" marginTop={1}>
							<UiText intent="error">{prompt.error.message}</UiText>
							{prompt.error.fix ? (
								<UiText intent="warning">What to do: {prompt.error.fix}</UiText>
							) : null}
						</Box>
					) : null}
					<Box marginTop={1}>
						<Hint>
							{keyFor(TEXT_KEYS, "accept")} accepts
							{prompt.field === "user" ? "; an empty name creates no user" : ""}.{" "}
							{keyFor(TEXT_KEYS, "cancel")} leaves it as it was.
						</Hint>
					</Box>
				</Section>
			) : prompt.kind === "password" ? (
				<Section title={`Password of ${prompt.name}`}>
					<Entry
						label={prompt.first === null ? "Password:" : "Once more:"}
						text={prompt.text}
						secret
					/>
					{prompt.error ? (
						<Box marginTop={1}>
							<UiText intent="error">{prompt.error}</UiText>
						</Box>
					) : null}
					<Box marginTop={1}>
						<Hint>
							It shows as dots and is typed twice. {keyFor(TEXT_KEYS, "accept")} accepts
							{prompt.who === "root" && prompt.first === null
								? "; empty gives root no password"
								: ""}
							. {keyFor(TEXT_KEYS, "cancel")} leaves it as it was.
						</Hint>
					</Box>
				</Section>
			) : null}
		</Box>
	);
}

const RECORD_STATUS: Record<StepRecord["status"], StepStatus> = {
	planned: "planned",
	done: "ok",
	failed: "failed",
	not_run: "planned",
};

export function ReviewPage({
	session,
	prompt,
}: {
	session: Session;
	prompt: Prompt | null;
}): ReactNode {
	const { answers, plan, apply, target } = session;
	const heading = (
		<Heading
			title="Review and apply"
			subtitle={`recsetup works the commands out from the system itself and runs them in order, stopping at the first that fails.${apply.kind === "idle" ? " Nothing has changed yet." : ""}`}
		/>
	);
	const waiting = waitsFor(session, "review");
	if (waiting) {
		return (
			<Box flexDirection="column">
				{heading}
				<Waiting session={session} page="review" />
			</Box>
		);
	}
	const records =
		apply.kind === "ok" ? apply.value.steps : apply.kind === "failed" ? apply.result?.steps : null;
	const failed = records?.find((record) => record.status === "failed") ?? null;
	return (
		<Box flexDirection="column">
			{heading}
			{prompt?.kind === "apply" && plan.kind === "ok" ? (
				<Callout
					tone="warning"
					title={`Apply these ${plan.value.steps.length} steps to ${target?.path}?`}
				>
					<UiText>
						{keyFor(CONFIRM_KEYS, "yes")} runs them; {keyFor(CONFIRM_KEYS, "no")} goes back.
					</UiText>
				</Callout>
			) : null}
			<Section title="Your answers">
				<Facts
					rows={FIELDS.map((field): [string, ReactNode] => [
						PAGES[field].title,
						shown(field, answers, true),
					])}
				/>
			</Section>
			{!canLogIn(answers) ? (
				<Callout tone="danger" title="Nobody could log in">
					<UiText>
						Root has no password and no user is created. Set a root password or create a user before
						applying.
					</UiText>
				</Callout>
			) : null}
			{apply.kind === "ok" ? (
				<Callout tone="success" title="Configured">
					<UiText>Every step ran. {keyFor(MAIN_KEYS, "go")} goes on.</UiText>
				</Callout>
			) : apply.kind === "failed" ? (
				<Box flexDirection="column">
					<FailureCallout title="The configuration stopped" failure={apply.failure} />
					{failed?.stderr?.trim() ? (
						<Section title={`What "${failed.description}" printed`}>
							<UiText>{truncateLines(failed.stderr.trim(), 6)}</UiText>
						</Section>
					) : null}
				</Box>
			) : null}
			{apply.kind === "running" ? (
				<UiText intent="warning">Applying the configuration to {target?.path}…</UiText>
			) : null}
			{records ? (
				<Section title="Steps" trailing={`${records.length}`}>
					<StepList
						steps={records.map((record) => ({
							phase: sectionName(record.section),
							command: record.description,
							status: RECORD_STATUS[record.status],
						}))}
					/>
				</Section>
			) : plan.kind === "failed" ? (
				<Box flexDirection="column">
					<FailureCallout title="recsetup refuses these answers" failure={plan.failure} />
					<Hint>Change the answer it names, then come back here.</Hint>
				</Box>
			) : plan.kind !== "ok" ? (
				<UiText intent="warning">Working out the commands…</UiText>
			) : (
				<Box flexDirection="column">
					{plan.value.warnings.map((warning) => (
						<Callout key={warning} tone="warning" title="Check this first">
							<UiText>{warning}</UiText>
						</Callout>
					))}
					<Section title="What will run" trailing={`${plan.value.steps.length} steps`}>
						<StepList
							steps={plan.value.steps.map((step) => ({
								phase: sectionName(step.section),
								command: step.description,
								status: apply.kind === "running" ? "running" : "planned",
							}))}
						/>
					</Section>
					<Section title="The commands">
						<Commands lines={plan.value.steps.map((step) => step.command)} />
					</Section>
				</Box>
			)}
			{apply.kind === "failed" ? (
				<Hint>
					Fix what it says (a shell is one key away in the install steps), then{" "}
					{keyFor(MAIN_KEYS, "go")} applies again.
				</Hint>
			) : apply.kind === "idle" && plan.kind === "ok" && canLogIn(answers) ? (
				<Hint>{keyFor(MAIN_KEYS, "go")} applies them; you confirm first.</Hint>
			) : null}
		</Box>
	);
}

export function DonePage({ session, then }: { session: Session; then: Then }): ReactNode {
	const { saved, apply, answers, target } = session;
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
			<Heading title="Done" subtitle="The new system is configured." />
			{saved.kind === "ok" ? (
				<Callout tone="success" title="System configured">
					<UiText>
						Next: {STEP_INFO.boot.title.toLowerCase()}. {STEP_INFO.boot.about}{" "}
						{then === "hub"
							? `${keyFor(MAIN_KEYS, "go")} or ${keyFor(MAIN_KEYS, "quit")} goes back to the install steps.`
							: `The install guide has it (${guideTitle("installation-boot")}).`}
					</UiText>
				</Callout>
			) : (
				<Callout tone="warning" title="The step isn't recorded">
					<UiText>
						The system is configured, but {saved.path} couldn't be updated: {saved.message}. The
						install steps won't know this step is done.
					</UiText>
				</Callout>
			)}
			<Section title="What was set">
				<Facts
					rows={[
						["System", target?.path ?? ""],
						...FIELDS.map((field): [string, ReactNode] => [
							PAGES[field].title,
							shown(field, answers, true),
						]),
						["Steps run", `${apply.value.steps.length}`],
						["Recorded in", saved.kind === "ok" ? saved.path : statePath()],
					]}
				/>
			</Section>
		</Box>
	);
}
