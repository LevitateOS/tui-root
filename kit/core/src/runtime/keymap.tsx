import { useApp, useInput, type Key } from "ink";
import {
	createContext,
	useContext,
	useLayoutEffect,
	useRef,
	type PropsWithChildren,
	type ReactNode,
} from "react";

/**
 * One name per keypress, exactly as typed: `q`, `G` (not `g`), `C-c` (never `c`),
 * `M-x`, `space`, `enter`, `escape`, `tab`, `S-tab`, `up`/`down`/`left`/`right`,
 * `pageup`/`pagedown`, `home`/`end`, `backspace`, `delete`.
 */
export type KeyName = string;

/** A key binding as data: what it does, which keys, and how to describe it. */
export type KeyBinding<A extends string = string> = {
	action: A;
	keys: readonly KeyName[];
	/** What the binding does, for footers and `--help`. */
	label: string;
	/** How a footer shows the keys; defaults to all of them joined with "/". `--help` always lists all. */
	hint?: string;
};

export type Keymap<A extends string = string> = readonly KeyBinding<A>[];

export type KeyHandlers<A extends string> = Partial<Record<A, (key: KeyName) => void>>;

export type KeymapOptions = {
	/** Inactive scopes receive nothing. Default true. */
	active?: boolean;
	/**
	 * Makes this a text-entry scope: printable input that none of its bindings claim
	 * goes here and to no other scope.
	 */
	onText?: (text: string) => void;
};

export function keyName(input: string, key: Key): KeyName | undefined {
	if (key.return) return "enter";
	if (key.escape) return "escape";
	if (key.tab) return key.shift ? "S-tab" : "tab";
	if (key.upArrow) return "up";
	if (key.downArrow) return "down";
	if (key.leftArrow) return "left";
	if (key.rightArrow) return "right";
	if (key.pageUp) return "pageup";
	if (key.pageDown) return "pagedown";
	if (key.home) return "home";
	if (key.end) return "end";
	if (key.backspace) return "backspace";
	if (key.delete) return "delete";
	if ([...input].length !== 1) return undefined;
	if (key.ctrl) return `C-${input.toLowerCase()}`;
	if (key.meta) return `M-${input}`;
	return input === " " ? "space" : input;
}

function isPrintable(input: string, key: Key): boolean {
	return (
		input.length > 0 &&
		!key.ctrl &&
		!key.meta &&
		!key.return &&
		!key.escape &&
		!key.tab &&
		!key.backspace &&
		!key.delete
	);
}

type Scope = {
	keymap: Keymap;
	handlers: KeyHandlers<string>;
	active: boolean;
	onText?: (text: string) => void;
};

const KeyboardContext = createContext<Scope[] | null>(null);

/**
 * The app's one keyboard listener. Each keypress runs at most one binding: a
 * text-entry scope (the most recently mounted active one) is asked first, then the
 * other active scopes in mount order. An unbound Ctrl-C exits the app.
 */
export function KeyboardProvider({ children }: PropsWithChildren): ReactNode {
	const scopes = useRef<Scope[]>([]).current;
	const { exit } = useApp();

	useInput((input, key) => {
		const name = keyName(input, key);
		const run = (scope: Scope): boolean => {
			if (name === undefined) return false;
			const binding = scope.keymap.find((b) => b.keys.includes(name));
			const handler = binding && scope.handlers[binding.action];
			if (!handler) return false;
			handler(name);
			return true;
		};

		const active = scopes.filter((scope) => scope.active);
		const textScope = active.filter((scope) => scope.onText).at(-1);
		if (textScope) {
			if (run(textScope)) return;
			if (isPrintable(input, key)) {
				textScope.onText?.(input);
				return;
			}
		}
		for (const scope of active) {
			if (scope !== textScope && run(scope)) return;
		}
		if (name === "C-c") {
			exit();
		}
	});

	return <KeyboardContext.Provider value={scopes}>{children}</KeyboardContext.Provider>;
}

/** Binds `keymap` to `handlers` while `options.active` holds. Bindings without a handler are ignored. */
export function useKeymap<A extends string>(
	keymap: Keymap<A>,
	handlers: KeyHandlers<A>,
	options: KeymapOptions = {},
): void {
	const scopes = useContext(KeyboardContext);
	if (!scopes) {
		throw new Error("useKeymap must be used inside <KeyboardProvider> (renderApp mounts it).");
	}
	const scope = useRef<Scope>({ keymap, handlers, active: true }).current;
	scope.keymap = keymap;
	scope.handlers = handlers as KeyHandlers<string>;
	scope.active = options.active ?? true;
	scope.onText = options.onText;

	useLayoutEffect(() => {
		scopes.push(scope);
		return () => {
			scopes.splice(scopes.indexOf(scope), 1);
		};
	}, [scopes, scope]);
}

const KEY_DISPLAY: Record<string, string> = {
	up: "↑",
	down: "↓",
	left: "←",
	right: "→",
	pageup: "PgUp",
	pagedown: "PgDn",
	escape: "Esc",
	enter: "Enter",
	space: "Space",
	tab: "Tab",
	"S-tab": "S-Tab",
	backspace: "Bksp",
};

function allKeys(binding: KeyBinding): string {
	return binding.keys
		.map((key) => KEY_DISPLAY[key] ?? (key.startsWith("C-") ? `Ctrl-${key.slice(2)}` : key))
		.join("/");
}

/** How a footer shows a binding's keys: its `hint`, or all its keys. */
export function keyHint(binding: KeyBinding): string {
	return binding.hint ?? allKeys(binding);
}

/** `--help` lines for a keymap: keys, then what they do. */
export function keymapHelp(keymap: Keymap): string {
	const hints = keymap.map(allKeys);
	const width = Math.max(0, ...hints.map((hint) => hint.length));
	return keymap.map((binding, i) => `  ${hints[i].padEnd(width)}  ${binding.label}`).join("\n");
}
