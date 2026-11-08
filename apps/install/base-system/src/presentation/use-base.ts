/** The screen's state: the target, the runs so far, and the question being asked. */
import { useEffect, useRef, useState } from "react";
import { runCommand, startCommand } from "@levitate/tui-kit";
import { readStrapEvent, STRAP_SCHEMA_VERSION } from "../generated/recstrap";
import {
	checkCommand,
	copyCommand,
	failure,
	fstabCommand,
	saveBaseStep,
	toFstabRun,
} from "../app/runner";
import { conflicts, type Copy, type Session, type Target } from "../domain/base";

/** Asked before the fstab write replaces lines already in the target's fstab. */
export type Prompt = { kind: "replace"; lines: readonly number[] };

export type Base = ReturnType<typeof useBase>;

export function useBase(target: Target | null) {
	const [session, setSession] = useState<Session>({
		target,
		check: { kind: "idle" },
		copy: { kind: "idle" },
		fstab: { kind: "idle" },
		write: { kind: "idle" },
		saved: null,
	});
	const [prompt, setPrompt] = useState<Prompt | null>(null);
	const [now, setNow] = useState(Date.now());
	// A ref, not state: two keys handled in one batch must not both start a run.
	const busy = useRef(false);
	const update = (change: Partial<Session>) => setSession((s) => ({ ...s, ...change }));
	const setCopy = (change: (copy: Copy) => Copy) =>
		setSession((s) => ({ ...s, copy: change(s.copy) }));

	const guard = (run: () => Promise<void>) => {
		if (busy.current) return false;
		busy.current = true;
		void run().finally(() => {
			busy.current = false;
		});
		return true;
	};

	const check = () =>
		target !== null &&
		guard(async () => {
			const argv = checkCommand(target.path);
			update({ check: { kind: "running", argv } });
			const result = await runCommand(argv);
			const event = readStrapEvent(result.stdout.trim().split("\n").at(-1) ?? "");
			update({
				check:
					result.exitCode === 0 && event?.event === "checked"
						? { kind: "ok", argv, value: event }
						: {
								kind: "failed",
								failure: failure(
									result,
									result.exitCode === 0 ? "recstrap printed no check result" : undefined,
								),
							},
			});
		});

	const fetchFstab = async (path: string) => {
		const argv = fstabCommand(path, "no");
		update({ fstab: { kind: "running", argv }, write: { kind: "idle" } });
		update({ fstab: toFstabRun(await runCommand(argv)) });
	};
	const readFstab = () => target !== null && guard(() => fetchFstab(target.path));

	const copy = () =>
		target !== null &&
		guard(async () => {
			const argv = copyCommand(target.path);
			setNow(Date.now());
			update({
				copy: {
					kind: "running",
					argv,
					startedAt: Date.now(),
					start: null,
					entries: 0,
					bytes: 0,
					verifying: false,
				},
			});
			let start = null as Extract<Copy, { kind: "running" }>["start"];
			let done = null as Extract<Copy, { kind: "ok" }>["done"] | null;
			let entries = 0;
			const result = await startCommand(argv, {
				onLine: (line) => {
					const event = readStrapEvent(line);
					if (!event) return;
					if (event.event === "start" && event.schema_version === STRAP_SCHEMA_VERSION) {
						start = event;
						setCopy((c) => (c.kind === "running" ? { ...c, start: event } : c));
					} else if (event.event === "progress") {
						entries = event.entries;
						setCopy((c) =>
							c.kind === "running" ? { ...c, entries: event.entries, bytes: event.bytes } : c,
						);
					} else if (event.event === "verify") {
						setCopy((c) => (c.kind === "running" ? { ...c, verifying: true } : c));
					} else if (event.event === "done") {
						done = event;
					}
				},
			}).result;
			update({
				copy:
					result.exitCode === 0 && done
						? { kind: "ok", argv, start, done }
						: {
								kind: "failed",
								start,
								entries,
								failure: failure(
									result,
									result.exitCode === 0 ? "recstrap finished without a done event" : undefined,
								),
							},
			});
			// The entries to review come straight after.
			if (result.exitCode === 0 && done) await fetchFstab(target.path);
		});

	const runWrite = (mode: "append" | "replace") =>
		target !== null &&
		guard(async () => {
			setPrompt(null);
			const argv = fstabCommand(target.path, mode);
			update({ write: { kind: "running", argv } });
			const run = toFstabRun(await runCommand(argv));
			setSession((s) => {
				if (run.kind !== "ok") return { ...s, write: run };
				// null: recstrap did not say (the install state's "unknown").
				const rootfs =
					s.copy.kind === "ok"
						? (s.copy.start?.rootfs ?? null)
						: s.check.kind === "ok"
							? s.check.value.rootfs
							: null;
				const saved = saveBaseStep({
					target: target.path,
					rootfs,
					entries: s.copy.kind === "ok" ? s.copy.done.entries : null,
					fstab: run.value.fstab_path,
				});
				return { ...s, write: run, saved };
			});
		});

	/** Writes the reviewed entries; asks first when they replace lines already there. */
	const write = (): string | null => {
		if (session.fstab.kind !== "ok") return "the fstab entries haven't been read";
		const replaced = conflicts(session.fstab.value);
		if (replaced.length > 0) {
			setPrompt({ kind: "replace", lines: replaced.map((line) => line.line) });
			return null;
		}
		runWrite("append");
		return null;
	};

	useEffect(() => void check(), []);

	// The elapsed time ticks while the copy runs.
	const copying = session.copy.kind === "running";
	useEffect(() => {
		if (!copying) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [copying]);

	const running =
		session.check.kind === "running" ||
		session.copy.kind === "running" ||
		session.fstab.kind === "running" ||
		session.write.kind === "running";

	return {
		session,
		prompt,
		now,
		running,
		copying,
		check,
		copy,
		readFstab,
		write,
		confirmReplace: () => runWrite("replace"),
		cancel: () => setPrompt(null),
	};
}
