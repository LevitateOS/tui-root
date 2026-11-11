import { useEffect, useRef, useState } from "react";
import { startCommand, type CommandResult } from "@levitate/tui-kit";
import type { Status } from "../generated/recab";
import { completePath, readRecabStatus, type StatusRead } from "../app/recab-runner";
import {
	operationArgv,
	TAKES_MACHINE_DOWN,
	type ActionPlan,
	type ActionId,
} from "../domain/actions";
export type Prompt =
	| {
			kind: "path";
			plan: ActionPlan;
			index: number;
			answers: Record<string, string>;
			text: string;
			error: string | null;
	  }
	| {
			kind: "confirm";
			plan: ActionPlan;
			action: ActionId;
			argv: readonly string[];
			destructive: boolean;
	  };
export type Run = {
	id: number;
	action: ActionId;
	argv: readonly string[];
	before: Status | null;
	startedAt: number;
	result: CommandResult | null;
	after: StatusRead | null;
};
export type Recab = ReturnType<typeof useRecab>;
export function useRecab() {
	const [status, setStatus] = useState<StatusRead>({ kind: "reading" });
	const [prompt, setPrompt] = useState<Prompt | null>(null);
	const [runs, setRuns] = useState<readonly Run[]>([]);
	const [now, setNow] = useState(Date.now());
	const busy = useRef(false);
	const nextId = useRef(1);
	const refresh = async () => {
		const read = await readRecabStatus();
		setStatus(read);
		return read;
	};
	useEffect(() => void refresh(), []);
	const running = runs.find((r) => r.result === null) ?? null;
	useEffect(() => {
		if (!running) return;
		const timer = setInterval(() => {
			setNow(Date.now());
			void refresh();
		}, 1000);
		return () => clearInterval(timer);
	}, [running?.id]);
	const current = status.kind === "ok" ? status.status : null;
	const execute = (action: ActionId, argv: readonly string[]) => {
		if (busy.current) return;
		busy.current = true;
		setPrompt(null);
		const id = nextId.current++;
		setRuns((all) => [
			{ id, action, argv, before: current, startedAt: Date.now(), result: null, after: null },
			...all,
		]);
		void startCommand(argv).result.then(async (result) => {
			const after = TAKES_MACHINE_DOWN[action] ? null : await refresh();
			setRuns((all) => all.map((r) => (r.id === id ? { ...r, result, after } : r)));
			busy.current = false;
		});
	};
	const begin = (plan: ActionPlan): string | null => {
		if (busy.current) return "A command is running";
		if (plan.verdict.kind !== "ready") return plan.verdict.reason;
		if (plan.inputs.length)
			setPrompt({ kind: "path", plan, index: 0, answers: {}, text: "", error: null });
		else
			setPrompt({
				kind: "confirm",
				plan,
				action: plan.id,
				argv: plan.argv,
				destructive: plan.destructive,
			});
		return null;
	};
	const type = (text: string) =>
		setPrompt((p) => (p?.kind === "path" ? { ...p, text: p.text + text, error: null } : p));
	const erase = () =>
		setPrompt((p) => (p?.kind === "path" ? { ...p, text: p.text.slice(0, -1) } : p));
	const complete = () =>
		setPrompt((p) => (p?.kind === "path" ? { ...p, text: completePath(p.text) } : p));
	const cancel = () => setPrompt(null);
	const accept = () => {
		if (!prompt) return;
		if (prompt.kind === "confirm") return execute(prompt.action, prompt.argv);
		const field = prompt.plan.inputs[prompt.index]!;
		const value = prompt.text.trim();
		let error =
			field.required && !value
				? "A value is required"
				: field.choices.length && !field.choices.includes(value)
					? `Choose ${field.choices.join(", ")}`
					: null;
		if (
			!error &&
			field.name === "file" &&
			prompt.answers.choice &&
			prompt.answers.choice !== "edited" &&
			value
		)
			error = "A file is only used with an edited resolution";
		if (error) return setPrompt({ ...prompt, error });
		const answers = { ...prompt.answers, [field.name]: value };
		if (prompt.index + 1 < prompt.plan.inputs.length)
			return setPrompt({ ...prompt, index: prompt.index + 1, answers, text: "", error: null });
		if (answers.choice === "edited" && !answers.file)
			return setPrompt({ ...prompt, error: "An edited resolution requires a file" });
		setPrompt({
			kind: "confirm",
			plan: prompt.plan,
			action: prompt.plan.id,
			argv: operationArgv(prompt.plan, answers),
			destructive: prompt.plan.destructive,
		});
	};
	return {
		status,
		current,
		prompt,
		runs,
		running,
		now,
		refresh,
		begin,
		accept,
		type,
		erase,
		complete,
		cancel,
	};
}
