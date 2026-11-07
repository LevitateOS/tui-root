import { useEffect, useMemo, useState } from "react";
import { useKeymap, type Keymap } from "@levitate/tui-kit";
import {
	ROLE_HELP,
	type Filesystem,
	type InspectResult,
	type InstallMode,
	type Role,
} from "../generated/recpart";
import { formatBytes } from "../domain/recpart";
import {
	editOf,
	MIB,
	NO_EDITS,
	parseSize,
	project,
	roleFormats,
	rolesFor,
	spaceAfter,
	type Assignment,
	type Edits,
	type Projection,
	type Segment,
} from "../domain/layout";
import { CHOICE_KEYS, PARTITION_KEYS, TEXT_KEYS } from "./keymap";

type KeyBinding = Keymap[number];

export type ChoiceOption<T> = { value: T; label: string; help?: string };

/** A question the editor asks before it changes the layout. */
export type Prompt =
	| {
			kind: "size";
			title: string;
			text: string;
			/** What `%` is a share of, and the bounds an answer must fall in (MiB). */
			percentOf: number;
			minMb: number;
			maxMb: number;
			done: (mb: number) => void;
	  }
	| {
			kind: "choice";
			title: string;
			options: ReadonlyArray<ChoiceOption<unknown>>;
			index: number;
			done: (value: unknown) => void;
	  }
	| {
			kind: "text";
			title: string;
			hint: string;
			text: string;
			done: (text: string | null) => void;
	  };

/** A size prompt's answer, or why it can't be taken. */
export function sizeAnswer(
	prompt: Extract<Prompt, { kind: "size" }>,
): { kind: "ok"; mb: number } | { kind: "error"; message: string } {
	const parsed = parseSize(prompt.text, prompt.percentOf);
	if (parsed.kind === "invalid")
		return { kind: "error", message: "not a size (e.g. 20G, 512M, 50%, rest)" };
	const mb = parsed.kind === "rest" ? prompt.maxMb : parsed.mb;
	if (mb > prompt.maxMb)
		return { kind: "error", message: `more than the ${formatBytes(prompt.maxMb * MIB)} there is` };
	if (mb < prompt.minMb)
		return { kind: "error", message: `less than the minimum, ${formatBytes(prompt.minMb * MIB)}` };
	return { kind: "ok", mb };
}

const FILESYSTEMS: ReadonlyArray<ChoiceOption<Filesystem>> = [
	{ value: "ext4", label: "ext4", help: "Linux filesystem" },
	{ value: "vfat", label: "vfat", help: "FAT32, for the EFI partition" },
	{ value: "swap", label: "swap", help: "swap space" },
];

export type PartitionEditor = {
	projection: Projection | null;
	edits: Edits;
	selected: number;
	prompt: Prompt | null;
	notice: string | null;
	/** The keys that do something right now, for the footer. */
	keys: readonly KeyBinding[];
};

/** The partition editor's state and keys. `active` while its page has the keyboard. */
export function usePartitionEditor({
	inspect,
	mode,
	active,
	next,
	back,
}: {
	inspect: InspectResult | null;
	mode: InstallMode;
	active: boolean;
	next: () => void;
	back: () => void;
}): PartitionEditor {
	const [history, setHistory] = useState<Edits[]>([NO_EDITS]);
	const [selected, setSelected] = useState(0);
	const [prompt, setPrompt] = useState<Prompt | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const edits = history.at(-1)!;
	const projection = useMemo(() => (inspect ? project(inspect, edits) : null), [inspect, edits]);
	const segments = projection?.segments ?? [];
	const index = Math.min(selected, Math.max(0, segments.length - 1));
	const segment: Segment | undefined = segments[index];

	// Another disk, or a changed table, starts a new set of edits.
	useEffect(() => {
		setHistory([NO_EDITS]);
		setSelected(0);
		setPrompt(null);
	}, [inspect?.disk.path, inspect?.table_id]);

	const commit = (change: (edits: Edits) => Edits, message: string | null = null) => {
		setHistory((h) => [...h, change(h.at(-1)!)]);
		setNotice(message);
	};
	const ask = (p: Prompt) => {
		setNotice(null);
		setPrompt(p);
	};
	const close = () => setPrompt(null);

	const setExisting =
		(number: number, entry: Edits["existing"][number] | null) =>
		(e: Edits): Edits => {
			const existing = { ...e.existing };
			if (entry) existing[number] = entry;
			else delete existing[number];
			return { ...e, existing };
		};
	const setCreated =
		(id: number, change: (p: Edits["created"][number]) => Edits["created"][number] | null) =>
		(e: Edits): Edits => ({
			...e,
			created: e.created.flatMap((p) => {
				if (p.id !== id) return [p];
				const changed = change(p);
				return changed ? [changed] : [];
			}),
		});

	/** Asks for a role (and a mount point for `other`), then hands both on. */
	const askRole = (title: string, done: (assignment: Assignment) => void) => {
		const holders = (role: Role) =>
			segments
				.filter((s) => s.kind !== "free" && s.role === role)
				.map((s) => (s.kind === "existing" ? s.part.device : "a new partition"));
		ask({
			kind: "choice",
			title,
			index: 0,
			options: [
				...rolesFor(mode).map((role) => ({
					value: role as Role | null,
					label: role,
					help: `${role === "other" ? "mounted where you say (you're asked next)" : ROLE_HELP[role]}${holders(role).length ? ` · now ${holders(role).join(", ")}` : ""}`,
				})),
				{ value: null, label: "none", help: "not used by the installed system" },
			],
			done: (value) => {
				const role = value as Role | null;
				if (role !== "other") return done({ role, mountpoint: null });
				ask({
					kind: "text",
					title: "Mount point",
					hint: "an absolute path, e.g. /srv",
					text: "",
					done: (text) => (text ? done({ role, mountpoint: text }) : close()),
				});
			},
		});
	};

	const actions = {
		select: (key: string) =>
			setSelected(
				Math.max(0, Math.min(segments.length - 1, index + (["up", "k"].includes(key) ? -1 : 1))),
			),
		create: () => {
			if (segment?.kind !== "free") return;
			const gap = segment;
			ask({
				kind: "size",
				title: `New partition in the ${formatBytes(gap.size)} free at ${formatBytes(gap.start)}`,
				text: "",
				percentOf: gap.size,
				minMb: 1,
				maxMb: Math.floor(gap.size / MIB),
				done: (mb) => {
					const rest = mb === Math.floor(gap.size / MIB);
					askRole("What the new partition is for", ({ role, mountpoint }) =>
						commit((e) => ({
							...e,
							created: [
								...e.created,
								{
									id: e.nextId,
									startMb: gap.start / MIB,
									sizeMb: rest ? null : mb,
									filesystem: null,
									label: null,
									role,
									mountpoint,
								},
							],
							nextId: e.nextId + 1,
						})),
					);
				},
			});
		},
		remove: () => {
			if (segment?.kind === "existing") {
				const entry = editOf(edits, segment.part.number);
				commit(
					setExisting(segment.part.number, {
						edit: { op: "delete" },
						role: null,
						mountpoint: null,
					}),
					`${segment.part.device} will be erased${entry.edit.op === "keep" && !entry.role ? "" : " (its other changes are dropped)"}`,
				);
			} else if (segment?.kind === "new") {
				commit(setCreated(segment.part.id, () => null));
			}
		},
		resize: () => {
			if (!segment || segment.kind === "free" || !projection) return;
			const maxMb = Math.floor((segment.size + spaceAfter(projection, segment)) / MIB);
			if (segment.kind === "new") {
				const part = segment.part;
				return ask({
					kind: "size",
					title: `Size of the new ${part.role ?? "partition"}`,
					text: "",
					percentOf: maxMb * MIB,
					minMb: 1,
					maxMb,
					done: (mb) =>
						commit(setCreated(part.id, (p) => ({ ...p, sizeMb: mb === maxMb ? null : mb }))),
				});
			}
			const { part } = segment;
			const entry = editOf(edits, part.number);
			if (part.min_size_bytes === null)
				return setNotice(
					`recpart can't resize ${part.device} (${part.filesystem ?? "no filesystem"})`,
				);
			if (entry.edit.op === "format" || roleFormats(entry.role))
				return setNotice(`${part.device} is formatted: delete it and create a new one instead`);
			ask({
				kind: "size",
				title: `Resize ${part.device} (${formatBytes(part.size_bytes)} now)`,
				text: "",
				percentOf: maxMb * MIB,
				minMb: Math.ceil(part.min_size_bytes / MIB),
				maxMb,
				done: (mb) =>
					commit(
						setExisting(part.number, {
							...entry,
							edit: mb * MIB === part.size_bytes ? { op: "keep" } : { op: "resize", sizeMb: mb },
						}),
					),
			});
		},
		format: () => {
			if (!segment || segment.kind === "free") return;
			ask({
				kind: "choice",
				title: "Filesystem",
				index: 0,
				options: FILESYSTEMS,
				done: (value) => {
					const filesystem = value as Filesystem;
					ask({
						kind: "text",
						title: "Filesystem label",
						hint: "Enter alone: the role's default label",
						text: "",
						done: (label) => {
							if (segment.kind === "new")
								return commit(setCreated(segment.part.id, (p) => ({ ...p, filesystem, label })));
							const entry = editOf(edits, segment.part.number);
							commit(
								setExisting(segment.part.number, {
									...entry,
									edit: { op: "format", filesystem, label },
								}),
								entry.edit.op === "resize"
									? `the resize of ${segment.part.device} is dropped`
									: null,
							);
						},
					});
				},
			});
		},
		role: () => {
			if (!segment || segment.kind === "free") return;
			askRole(
				`What ${segment.kind === "existing" ? segment.part.device : "the new partition"} is for`,
				(assignment) => {
					if (segment.kind === "new")
						return commit(setCreated(segment.part.id, (p) => ({ ...p, ...assignment })));
					const { part } = segment;
					const entry = editOf(edits, part.number);
					if (roleFormats(assignment.role) && entry.edit.op === "resize")
						return setNotice(
							`a ${assignment.role} partition is formatted, which can't follow a resize: delete ${part.device} and create one`,
						);
					const edit =
						roleFormats(assignment.role) && entry.edit.op !== "format"
							? ({ op: "format", filesystem: "ext4", label: null } as const)
							: entry.edit;
					commit(
						setExisting(part.number, { ...assignment, edit }),
						edit !== entry.edit
							? `${part.device} will be formatted: recpart formats every ${assignment.role}`
							: null,
					);
				},
			);
		},
		clear: () => {
			if (segment?.kind === "existing")
				commit(setExisting(segment.part.number, null), `${segment.part.device} stays as it is`);
		},
		table: () =>
			commit(
				(e) => ({ ...e, newTable: !e.newTable }),
				edits.newTable
					? "back to the current partition table"
					: "a new, empty partition table: every partition is erased",
			),
		undo: () => {
			if (history.length > 1) setHistory((h) => h.slice(0, -1));
			setNotice(history.length > 1 ? "undone" : "nothing to undo");
		},
		reset: () => {
			setHistory([NO_EDITS]);
			setNotice("back to what's on the disk");
		},
		next,
		back,
	};

	useKeymap(PARTITION_KEYS, actions, { active: active && prompt === null && projection !== null });

	const choice = prompt?.kind === "choice" ? prompt : null;
	useKeymap(
		CHOICE_KEYS,
		{
			move: (key) =>
				choice &&
				setPrompt({
					...choice,
					index:
						(choice.index + (["up", "k"].includes(key) ? -1 : 1) + choice.options.length) %
						choice.options.length,
				}),
			accept: () => {
				if (!choice) return;
				close();
				choice.done(choice.options[choice.index]!.value);
			},
			cancel: close,
		},
		{ active: active && choice !== null },
	);
	const typed = prompt?.kind === "size" || prompt?.kind === "text" ? prompt : null;
	useKeymap(
		TEXT_KEYS,
		{
			accept: () => {
				if (!typed) return;
				if (typed.kind === "text") {
					close();
					return typed.done(typed.text.trim() || null);
				}
				const answer = sizeAnswer(typed);
				if (answer.kind === "error") return setNotice(answer.message);
				close();
				typed.done(answer.mb);
			},
			erase: () => typed && setPrompt({ ...typed, text: typed.text.slice(0, -1) }),
			cancel: close,
		},
		{
			active: active && typed !== null,
			onText: (text) => typed && setPrompt({ ...typed, text: typed.text + text }),
		},
	);

	const keys: KeyBinding[] = prompt
		? prompt.kind === "choice"
			? [...CHOICE_KEYS]
			: [...TEXT_KEYS]
		: PARTITION_KEYS.filter((binding) => {
				switch (binding.action) {
					case "create":
						return segment?.kind === "free";
					case "remove":
					case "resize":
					case "format":
					case "role":
						return segment !== undefined && segment.kind !== "free";
					case "clear":
						return (
							segment?.kind === "existing" && edits.existing[segment.part.number] !== undefined
						);
					case "undo":
						return history.length > 1;
					case "reset":
						return history.length > 1;
					default:
						return true;
				}
			});
	return { projection, edits, selected: index, prompt, notice, keys };
}
