/** The screen's state: recab's status, the question being asked, and the runs so far. */
import { useEffect, useRef, useState } from "react";
import { startCommand, type CommandResult } from "@levitate/tui-kit";
import type { Slot, Status } from "../generated/recab";
import { checkPath, completePath, readRecabStatus, type StatusRead } from "../app/recab-runner";
import { stageArgv, type ActionId, type ActionPlan, type StageAnswers } from "../domain/actions";

export type StageField = keyof StageAnswers;

const FIELDS: readonly StageField[] = ["rootfs", "kernel", "initrd"];

export const FIELD_QUESTION: Record<StageField, string> = {
	rootfs: "The system image: an EROFS file, or a partition holding one",
	kernel: "The kernel image (vmlinuz) for the new system",
	initrd: "Its initramfs (leave empty if it boots without one)",
};

export type Prompt =
	| { kind: "path"; field: StageField; answers: StageAnswers; text: string; error: string | null }
	| { kind: "confirm"; action: ActionId; argv: readonly string[] }
	| { kind: "token"; action: ActionId; argv: readonly string[]; slot: Slot; text: string };

export type Run = {
	id: number;
	action: ActionId;
	argv: readonly string[];
	before: Status | null;
	startedAt: number;
	result: CommandResult | null;
	/** The status read once it finished. */
	after: StatusRead | null;
};

export type Recab = ReturnType<typeof useRecab>;

export function useRecab() {
	const [status, setStatus] = useState<StatusRead>({ kind: "reading" });
	const [prompt, setPrompt] = useState<Prompt | null>(null);
	const [runs, setRuns] = useState<readonly Run[]>([]);
	const [now, setNow] = useState(Date.now());
	// A ref, not state: two keys handled in one batch must not both start a run.
	const busy = useRef(false);
	const nextId = useRef(1);

	const refresh = async (): Promise<StatusRead> => {
		setStatus((s) => (s.kind === "failed" ? { kind: "reading" } : s));
		const read = await readRecabStatus();
		setStatus(read);
		return read;
	};
	useEffect(() => void refresh(), []);

	const running = runs.find((run) => run.result === null) ?? null;
	// The elapsed time ticks while something runs.
	useEffect(() => {
		if (!running) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [running?.id]);

	const current = status.kind === "ok" ? status.status : null;

	const execute = (action: ActionId, argv: readonly string[]) => {
		if (busy.current) return;
		busy.current = true;
		setPrompt(null);
		const id = nextId.current++;
		setNow(Date.now());
		setRuns((all) => [
			{ id, action, argv, before: current, startedAt: Date.now(), result: null, after: null },
			...all,
		]);
		void startCommand(argv).result.then(async (result) => {
			setRuns((all) => all.map((run) => (run.id === id ? { ...run, result } : run)));
			const after = action === "reboot" ? null : await refresh();
			setRuns((all) => all.map((run) => (run.id === id ? { ...run, after } : run)));
			busy.current = false;
		});
	};

	/** Enter on a change: ask what it needs, then for a yes. */
	const begin = (plan: ActionPlan): string | null => {
		if (busy.current) return "a change is running";
		if (plan.verdict.kind !== "ready") return plan.verdict.reason;
		if (plan.id === "stage") {
			setPrompt({
				kind: "path",
				field: "rootfs",
				answers: { rootfs: "", kernel: "", initrd: "" },
				text: "",
				error: null,
			});
			return null;
		}
		if (plan.argv) setPrompt({ kind: "confirm", action: plan.id, argv: plan.argv });
		return null;
	};

	const type = (text: string) =>
		setPrompt((p) =>
			p && p.kind !== "confirm"
				? { ...p, text: p.text + text, ...(p.kind === "path" ? { error: null } : {}) }
				: p,
		);
	const erase = () =>
		setPrompt((p) => (p && p.kind !== "confirm" ? { ...p, text: p.text.slice(0, -1) } : p));
	const complete = () =>
		setPrompt((p) => (p?.kind === "path" ? { ...p, text: completePath(p.text), error: null } : p));
	const cancel = () => setPrompt(null);

	const accept = () => {
		if (!prompt) return;
		if (prompt.kind === "confirm") return execute(prompt.action, prompt.argv);
		if (prompt.kind === "token") {
			if (prompt.text.trim().toUpperCase() === prompt.slot) execute(prompt.action, prompt.argv);
			else setPrompt({ ...prompt, text: "" });
			return;
		}
		const text = prompt.text.trim();
		const error =
			prompt.field === "initrd" && text === ""
				? null
				: checkPath(text, prompt.field === "rootfs" ? "image" : "file");
		if (error) return setPrompt({ ...prompt, error });
		const answers = { ...prompt.answers, [prompt.field]: text };
		const field = FIELDS[FIELDS.indexOf(prompt.field) + 1];
		if (field) return setPrompt({ kind: "path", field, answers, text: "", error: null });
		if (current)
			setPrompt({
				kind: "token",
				action: "stage",
				argv: stageArgv(answers),
				slot: current.inactive_slot,
				text: "",
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
