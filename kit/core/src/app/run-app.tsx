import { render } from "ink";
import { Component, type ReactElement, type ReactNode } from "react";
import { AppProvider } from "./app-provider";
import { KeyboardProvider, keymapHelp, type Keymap } from "../runtime/keymap";
import { detectColorRuntime } from "../theme/colors";
import { defaultTuiTheme, type TuiTheme } from "../theme/tokens";
import { errorMessage } from "../utils/strings";

/** A command-line flag. Without `value` it is a switch; with it, it takes one argument. */
export type Flag = {
	name: string;
	alias?: string;
	/** Placeholder for the argument, e.g. "SLUG"; absent for a switch. */
	value?: string;
	choices?: readonly string[];
	help: string;
};

export type Args = Record<string, string | true | undefined>;

/** Bad command-line input: printed with a pointer to --help, exit status 2. */
export class UsageError extends Error {}

export type AppSpec = {
	/** The command name, as typed. */
	name: string;
	summary: string;
	flags?: readonly Flag[];
	/** Extra help paragraphs. */
	notes?: readonly string[];
	/** Key sections for --help, in order. */
	keys?: readonly { title: string; keymap: Keymap }[];
	theme?: TuiTheme;
	/**
	 * Builds the screen from the parsed flags, or returns undefined after printing
	 * something itself (a non-interactive flag). Throw `UsageError` for bad input.
	 */
	run: (args: Args) => ReactElement | undefined;
};

function helpText(spec: AppSpec): string {
	const flags = [...(spec.flags ?? []), { name: "help", alias: "h", help: "show this help" }];
	const names = flags.map(
		(flag) =>
			`${flag.alias ? `-${flag.alias}, ` : ""}--${flag.name}${"value" in flag && flag.value ? ` ${flag.value}` : ""}`,
	);
	const width = Math.max(...names.map((name) => name.length));
	const sections = [
		`${spec.name}: ${spec.summary}`,
		`Usage: ${spec.name} [flags]`,
		["Flags:", ...flags.map((flag, i) => `  ${names[i].padEnd(width)}  ${flag.help}`)].join("\n"),
		...(spec.notes ?? []),
		...(spec.keys ?? []).map((section) => `${section.title}:\n${keymapHelp(section.keymap)}`),
	];
	return sections.join("\n\n");
}

function parseArgs(spec: AppSpec, argv: readonly string[]): Args | "help" {
	const flags = spec.flags ?? [];
	const args: Args = {};
	for (let i = 0; i < argv.length; i += 1) {
		const [word, inline] = argv[i].startsWith("--")
			? argv[i].split(/=(.*)/s, 2)
			: [argv[i], undefined];
		if (word === "--help" || word === "-h") return "help";
		const flag = flags.find((f) => word === `--${f.name}` || (f.alias && word === `-${f.alias}`));
		if (!flag) throw new UsageError(`unknown argument '${argv[i]}'`);
		if (!flag.value) {
			if (inline !== undefined) throw new UsageError(`--${flag.name} takes no value`);
			args[flag.name] = true;
			continue;
		}
		const value = inline ?? argv[++i];
		if (value === undefined || value.length === 0) {
			throw new UsageError(`--${flag.name} needs a ${flag.value}`);
		}
		if (flag.choices && !flag.choices.includes(value)) {
			throw new UsageError(`--${flag.name} must be one of: ${flag.choices.join(", ")}`);
		}
		args[flag.name] = value;
	}
	return args;
}

/**
 * Records a render error, then rethrows it so Ink's own boundary shows it and ends
 * the app. (An error in the first frame unmounts Ink before `waitUntilExit` can be
 * awaited, so the exit status can't come from that promise.)
 */
class RecordCrash extends Component<{ onCrash: (error: Error) => void; children: ReactNode }> {
	state = { error: null as Error | null };
	static getDerivedStateFromError(error: Error) {
		return { error };
	}
	render() {
		if (this.state.error) {
			// Rethrowing means this boundary never commits, so record it here, not in componentDidCatch.
			this.props.onCrash(this.state.error);
			throw this.state.error;
		}
		return this.props.children;
	}
}

/**
 * The whole life of a TUI app: flags (and --help), the TTY check, providers, keys,
 * and exit status (0 done, 1 crashed with the stack on stderr, 2 bad usage or no terminal).
 */
export function runApp(spec: AppSpec, argv: readonly string[] = process.argv.slice(2)): void {
	const fail = (status: number, message: string): never => {
		console.error(`${spec.name}: ${message}`);
		process.exit(status);
	};
	let element: ReactElement | undefined;
	try {
		const args = parseArgs(spec, argv);
		if (args === "help") {
			console.log(helpText(spec));
			return;
		}
		element = spec.run(args);
	} catch (error) {
		if (error instanceof UsageError) fail(2, `${error.message} (see --help)`);
		fail(1, errorMessage(error));
	}
	if (!element) return;
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		fail(2, "needs a terminal on stdin and stdout");
	}
	const app = {
		name: spec.name,
		theme: spec.theme ?? defaultTuiTheme,
		colors: detectColorRuntime(process.env),
	};
	let crash: Error | undefined;
	process.on("exit", () => {
		if (crash) {
			console.error(crash.stack ?? crash.message);
			process.exitCode = 1;
		}
	});
	const instance = render(
		<AppProvider app={app}>
			<RecordCrash onCrash={(error) => (crash = error)}>
				<KeyboardProvider>{element}</KeyboardProvider>
			</RecordCrash>
		</AppProvider>,
		// KeyboardProvider handles Ctrl-C, so a screen's quit binding can refuse it.
		{ exitOnCtrlC: false },
	);
	instance.waitUntilExit().then(
		() => process.exit(),
		() => process.exit(),
	);
}
