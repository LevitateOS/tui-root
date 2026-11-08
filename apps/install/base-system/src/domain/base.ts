/**
 * The base step's model: where the system goes, the three runs that put it there (the
 * check, the copy, the fstab), and what each page and the rail read from them.
 */
import type { DiskResult } from "@levitate/install-state";
import type { ErrorPayload, FstabResult, StrapEvent } from "../generated/recstrap";

/** Where the system goes, and where that came from. */
export type Target = {
	path: string;
	/** The disk step's result, when the install state file has one. */
	disk: DiskResult | null;
};

/** A run that failed: what ran, and recstrap's or recfstab's error when it printed one. */
export type Failure = {
	argv: readonly string[];
	exitCode: number | null;
	error: ErrorPayload | null;
	/** What it printed, when there is no error document. */
	output: string;
};

export type Checked = Extract<StrapEvent, { event: "checked" }>;
export type Start = Extract<StrapEvent, { event: "start" }>;
export type Done = Extract<StrapEvent, { event: "done" }>;

export type Run<T> =
	| { kind: "idle" }
	| { kind: "running"; argv: readonly string[] }
	| { kind: "ok"; argv: readonly string[]; value: T }
	| { kind: "failed"; failure: Failure };

/** The copy, as its events arrive. */
export type Copy =
	| { kind: "idle" }
	| {
			kind: "running";
			argv: readonly string[];
			startedAt: number;
			/** Null while the image is being mounted and counted. */
			start: Start | null;
			entries: number;
			bytes: number;
			verifying: boolean;
	  }
	| { kind: "ok"; argv: readonly string[]; start: Start | null; done: Done }
	| { kind: "failed"; failure: Failure; start: Start | null; entries: number };

/** Saving the step to the install state file. */
export type Saved =
	| { kind: "ok"; path: string }
	| { kind: "failed"; path: string; message: string };

export type Session = {
	target: Target | null;
	check: Run<Checked>;
	copy: Copy;
	/** `recfstab --json`: the entries to review. */
	fstab: Run<FstabResult>;
	/** `recfstab --write`. */
	write: Run<FstabResult>;
	saved: Saved | null;
};

export const PAGE_IDS = ["overview", "check", "copy", "fstab", "done"] as const;
export type PageId = (typeof PAGE_IDS)[number];

export type PageState = "done" | "running" | "failed" | "ready" | "waiting";

/** Each page's title, and the short name the rail gives it. */
export const PAGES: Record<PageId, { title: string; short: string }> = {
	overview: { title: "Overview", short: "Overview" },
	check: { title: "Check the target", short: "Check" },
	copy: { title: "Copy the system", short: "Copy" },
	fstab: { title: "Write the fstab", short: "fstab" },
	done: { title: "Done", short: "Done" },
};

/** The pages that are steps, in order; the rail numbers them. */
export const STEP_PAGES = ["check", "copy", "fstab"] as const satisfies readonly PageId[];

/** How far each step has got, for the rail. */
export function pageState(session: Session, page: PageId): PageState {
	const of = (run: { kind: string }, ready: boolean): PageState =>
		run.kind === "ok"
			? "done"
			: run.kind === "running"
				? "running"
				: run.kind === "failed"
					? "failed"
					: ready
						? "ready"
						: "waiting";
	switch (page) {
		case "overview":
			return session.target ? "done" : "failed";
		case "check":
			return of(session.check, session.target !== null);
		case "copy":
			return of(session.copy, session.check.kind === "ok");
		case "fstab":
			return session.write.kind === "idle" && session.fstab.kind !== "ok"
				? of(session.fstab, session.copy.kind === "ok")
				: of(session.write, session.fstab.kind === "ok");
		case "done":
			return session.saved?.kind === "ok"
				? "done"
				: session.saved?.kind === "failed"
					? "failed"
					: "waiting";
	}
}

/** The page the install is at: the first one not done. */
export function currentPage(session: Session): PageId {
	return PAGE_IDS.find((page) => pageState(session, page) !== "done") ?? "done";
}

/** What the page waits for, when its step can't start yet. */
export function waitsFor(session: Session, page: PageId): string | null {
	if (!session.target) return "a target: finish the disk step first, or start with --target";
	if (page === "copy" && session.check.kind !== "ok") return "the target to pass its checks";
	if (page === "fstab" && session.copy.kind !== "ok") return "the copy to finish";
	if (page === "done" && session.write.kind !== "ok") return "the fstab to be written";
	return null;
}

/** The fstab lines the write would replace. */
export function conflicts(fstab: FstabResult) {
	return fstab.existing.filter((line) => line.conflicts);
}

/** How far the copy has got, 0..1; null before the image is counted. */
export function copyFraction(copy: Copy): number | null {
	if (copy.kind === "ok") return 1;
	if (copy.kind === "idle" || !copy.start || copy.start.total_entries === 0) return null;
	return Math.min(1, copy.entries / copy.start.total_entries);
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatDuration(ms: number): string {
	const total = Math.max(0, Math.round(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Time left at the rate so far; null until there is a rate to go by. */
export function remaining(copy: Copy, now: number): number | null {
	if (copy.kind !== "running" || !copy.start || copy.entries === 0) return null;
	const elapsed = now - copy.startedAt;
	const fraction = copy.entries / copy.start.total_entries;
	if (elapsed < 2000 || fraction <= 0 || fraction >= 1) return null;
	return (elapsed / fraction) * (1 - fraction);
}
