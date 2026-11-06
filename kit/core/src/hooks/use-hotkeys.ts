import {
	useKeyInput,
	type InkKeyLike,
	type KeyInputEvent,
	type KeyInputHandler,
	type KeySpec,
	type UseKeyInputOptions,
} from "../runtime/ink/use-input";

export function useHotkeys(
	keys: KeySpec | undefined,
	handler: KeyInputHandler,
	options: UseKeyInputOptions = {},
): void {
	useKeyInput(keys, handler, options);
}

export type { InkKeyLike, KeyInputEvent, KeyInputHandler, KeySpec, UseKeyInputOptions };
