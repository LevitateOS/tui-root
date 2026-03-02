export type Slot = "A" | "B";

export type RecabStatus = {
	activeSlot: Slot;
	inactiveSlot: Slot;
	trialPending: boolean;
	nextBoot: Slot | null;
	defaultSlot: Slot | null;
	knownGoodSlot: Slot | null;
	entryPrefix: string;
};

export type RecabCommandSpec = {
	command: string;
	args: string[];
};

export type RecabCommandResult = {
	command: string;
	args: string[];
	exitCode: number;
	stdout: string;
	stderr: string;
	durationMs: number;
	failedToStart: boolean;
};

function asSlot(value: unknown): Slot | null {
	if (value === "A" || value === "B") {
		return value;
	}
	return null;
}

function asNullableSlot(value: unknown): Slot | null | undefined {
	if (value === null) {
		return null;
	}
	return asSlot(value);
}

function asString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	return value;
}

export function parseRecabStatusJson(input: string): RecabStatus | null {
	let raw: unknown;
	try {
		raw = JSON.parse(input);
	} catch {
		return null;
	}
	if (!raw || typeof raw !== "object") {
		return null;
	}

	const row = raw as Record<string, unknown>;
	const activeSlot = asSlot(row.active_slot);
	const inactiveSlot = asSlot(row.inactive_slot);
	const trialPending = row.trial_pending;
	const nextBoot = asNullableSlot(row.next_boot);
	const defaultSlot = asNullableSlot(row.default_slot);
	const knownGoodSlot = asNullableSlot(row.known_good_slot);
	const entryPrefix = asString(row.entry_prefix);

	if (!activeSlot || !inactiveSlot || typeof trialPending !== "boolean" || !entryPrefix) {
		return null;
	}
	if (nextBoot === undefined || defaultSlot === undefined || knownGoodSlot === undefined) {
		return null;
	}

	return {
		activeSlot,
		inactiveSlot,
		trialPending,
		nextBoot,
		defaultSlot,
		knownGoodSlot,
		entryPrefix,
	};
}

export function formatSlot(value: Slot | null): string {
	return value ?? "(none)";
}
