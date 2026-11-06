import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../utils/strings";

export type AsyncTask<T> =
	| { kind: "idle" }
	| { kind: "running" }
	| { kind: "done"; value: T }
	| { kind: "error"; message: string };

/**
 * Runs `run` whenever `key` changes (a null key runs nothing). A result from a run
 * whose key has since changed is dropped; a synchronous throw counts as an error,
 * like a rejection. `run` itself may change every render.
 */
export function useAsyncTask<T>(key: string | null, run: () => Promise<T>): AsyncTask<T> {
	const [state, setState] = useState<{ key: string | null; task: AsyncTask<T> }>({
		key: null,
		task: { kind: "idle" },
	});
	const latest = useRef(run);
	latest.current = run;
	useEffect(() => {
		if (key === null) {
			setState({ key, task: { kind: "idle" } });
			return;
		}
		let current = true;
		setState({ key, task: { kind: "running" } });
		const settle = (task: AsyncTask<T>) => {
			if (current) setState({ key, task });
		};
		new Promise<T>((resolve) => resolve(latest.current())).then(
			(value) => settle({ kind: "done", value }),
			(error: unknown) => settle({ kind: "error", message: errorMessage(error) }),
		);
		return () => {
			current = false;
		};
	}, [key]);
	// Before the effect for a new key has run, report it as running, not the old result.
	return state.key === key ? state.task : key === null ? { kind: "idle" } : { kind: "running" };
}
