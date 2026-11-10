/** The pages: the system being configured, one page a question, the plan to review and
 * apply, and what was recorded. */
import { Box, Text } from "ink";
import type { ReactNode } from "react";
import {
	keyFor,
	Callout,
	Commands,
	Facts,
	Heading,
	Section,
	StepList,
	Table,
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
			return "The console keyboard layout of the new system. It is loaded on this console as soon as you choose it, so the passwords you type next come out the same after the reboot.";
		case "timezone":
			return "The time zone the new system keeps its clock in.";
		case "locale":
			return "The system language and formats (LANG). These are the ones the system ships.";
		case "hostname":
			return "The machine's name, on its prompt and on the network.";
		case "root":
			return `The password of root, the system's own administrator. Leave it empty to give root none: then only the user you create next can administer the system, with ${tool}.`;
		case "user":
			return `Your own account, to log in with. It is an administrator: it can use ${tool}. Leave the name empty to create none.`;
	}
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
			<Text bold>{secret ? "•".repeat([...text].length) : text}</Text>
			<Text inverse> </Text>
		</Text>
	);
}

const COLUMN: Record<PickField, string> = {
	keymap: "Keyboard layout",
	timezone: "Time zone",
	locale: "Language",
};

function PickList({
	prompt,
	all,
	rows,
}: {
	prompt: Extract<Prompt, { kind: "pick" }>;
	all: readonly string[];
	rows: number;
}): ReactNode {
	const list = matching(all, prompt.filter);
	const { start, end } = listWindow(list.length, prompt.index, rows);
	const hidden = [
		start > 0 ? `${start} above` : null,
		end < list.length ? `${list.length - end} below` : null,
	].filter(Boolean);
	return (
		<Section title="Choose one" trailing={`${list.length} of ${all.length}`}>
			<Entry label="Type to narrow the list:" text={prompt.filter} />
			{list.length === 0 ? (
				<UiText intent="warning">
					Nothing matches. {keyFor(PICK_KEYS, "erase")} erases what you typed.
				</UiText>
			) : (
				<Table
					columns={[{ title: COLUMN[prompt.field] }]}
					rows={list.slice(start, end).map((name) => [name])}
					selected={prompt.index - start}
				/>
			)}
			{hidden.length > 0 ? <Hint>{hidden.join(", ")}</Hint> : null}
		</Section>
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
}: {
	field: FieldId;
	session: Session;
	prompt: Prompt | null;
	listRows: number;
}): ReactNode {
	const system = session.inspect.kind === "ok" ? session.inspect.value : null;
	const heading = (
		<Heading title={PAGES[field].title} subtitle={about(field, system?.target ?? null)} />
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
				<PickList prompt={prompt} all={options(prompt.field, system.choices)} rows={listRows} />
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
