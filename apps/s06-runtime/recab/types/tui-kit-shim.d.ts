declare module "@levitate/tui-kit" {
	import type { ReactNode } from "react";

	export type RenderedTuiApp = {
		waitUntilExit: () => Promise<void>;
	};

	export type StatusAtom = {
		text: string;
		intent?: string;
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
	};

	export type StatusSegment = {
		id: string;
		atoms: ReadonlyArray<StatusAtom>;
	};

	export function createTuiApp(options?: { title?: string }): unknown;
	export function renderApp(
		element: ReactNode,
		options: { app?: unknown; exitOnCtrlC?: boolean },
	): RenderedTuiApp;

	export function KeyValue(props: {
		entries: ReadonlyArray<{ key: string; value: string }>;
	}): ReactNode;
	export function SectionList(props: {
		items: ReadonlyArray<{ section: string; label: string }>;
		selectedIndex: number;
		maxWidth?: number;
		emptyLabel?: string;
		marker?: string;
		inactiveMarker?: string;
		sectionPrefix?: string;
	}): ReactNode;
	export function SegmentedStatusLine(props: {
		segments: ReadonlyArray<StatusSegment>;
		separator?: string;
		separatorIntent?: string;
	}): ReactNode;
	export function SurfaceFrame(props: {
		title?: ReactNode;
		showHeader?: boolean;
		leftWidth?: number;
		footer?: ReactNode;
		leftPane: {
			title?: ReactNode;
			titleMode?: "none" | "inline" | "slot";
			body: ReactNode;
			borderIntent?: string;
			textIntent?: string;
			titleIntent?: string;
		};
		rightPane: {
			title?: ReactNode;
			titleMode?: "none" | "inline" | "slot";
			body: ReactNode;
			borderIntent?: string;
			textIntent?: string;
			titleIntent?: string;
		};
	}): ReactNode;
	export function UiText(props: {
		children: ReactNode;
		intent?: string;
		bold?: boolean;
	}): ReactNode;
	export function hotkeyStatusSegment(
		id: string,
		key: string,
		label: string,
		keyIntent?: string,
		labelIntent?: string,
	): StatusSegment;
	export function scopeStatusSegment(scope: string, intent?: string): StatusSegment;
	export function textStatusSegment(
		id: string,
		text: string,
		intent?: string,
		bold?: boolean,
	): StatusSegment;
	export function useHotkeys(
		keys: string | ReadonlyArray<string> | undefined,
		handler: () => void,
		options?: { isActive?: boolean },
	): void;
	export function useListNavigation(
		count: number,
		initialIndex?: number,
	): {
		currentIndex: number;
		safeIndex: number;
		moveBy: (delta: number) => void;
		setIndex: (index: number) => void;
	};
}
