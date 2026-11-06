import { keyHint, type Keymap } from "../../runtime/keymap";
import { Text } from "ink";

import type { ColorIntent } from "../../theme/tokens";

import { useTuiColors, useTuiTheme } from "../../app/app-provider";

import { resolveIntentColor } from "../../theme/colors";

type StatusAtom = {
	text: string;
	intent?: ColorIntent;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
};

export type StatusSegment = {
	id: string;
	atoms: ReadonlyArray<StatusAtom>;
};

type FlattenStatusSegmentsOptions = {
	separator?: string;
	separatorIntent?: ColorIntent;
};

function flattenStatusSegments(
	segments: ReadonlyArray<StatusSegment>,
	options: FlattenStatusSegmentsOptions = {},
): StatusAtom[] {
	const separator = options.separator ?? " | ";
	const separatorIntent = options.separatorIntent ?? "dimText";
	const atoms: StatusAtom[] = [];

	for (const [index, segment] of segments.entries()) {
		if (index > 0 && separator.length > 0) {
			atoms.push({
				text: separator,
				intent: separatorIntent,
			});
		}
		for (const atom of segment.atoms) {
			if (atom.text.length === 0) {
				continue;
			}
			atoms.push(atom);
		}
	}

	return atoms;
}

type SegmentedStatusLineProps = {
	segments: ReadonlyArray<StatusSegment>;
	separator?: string;
	separatorIntent?: ColorIntent;
};

export function SegmentedStatusLine({
	segments,
	separator,
	separatorIntent,
}: SegmentedStatusLineProps) {
	const theme = useTuiTheme();
	const colors = useTuiColors();
	const atoms = flattenStatusSegments(segments, {
		separator,
		separatorIntent,
	});

	return (
		<Text>
			{atoms.map((atom, index) => (
				<Text
					key={`${index}-${atom.text}`}
					color={resolveIntentColor(theme, atom.intent ?? "dimText", colors)}
					bold={atom.bold}
					italic={atom.italic}
					underline={atom.underline}
				>
					{atom.text}
				</Text>
			))}
		</Text>
	);
}

export function scopeStatusSegment(scope: string, intent: ColorIntent = "accent"): StatusSegment {
	const normalized = scope.trim().length > 0 ? scope.trim() : "tui";
	return {
		id: `scope-${normalized}`,
		atoms: [
			{
				text: `[${normalized}]`,
				intent,
				bold: true,
			},
		],
	};
}

export function hotkeyStatusSegment(
	id: string,
	key: string,
	label: string,
	keyIntent: ColorIntent = "accent",
	labelIntent: ColorIntent = "dimText",
): StatusSegment {
	const normalizedKey = key.trim();
	const normalizedLabel = label.trim();

	return {
		id,
		atoms: [
			{
				text: normalizedKey.length > 0 ? normalizedKey : "?",
				intent: keyIntent,
				bold: true,
			},
			{
				text: normalizedLabel.length > 0 ? ` ${normalizedLabel}` : "",
				intent: labelIntent,
			},
		],
	};
}

export function textStatusSegment(
	id: string,
	text: string,
	intent: ColorIntent = "dimText",
	bold = false,
): StatusSegment {
	return {
		id,
		atoms: [
			{
				text,
				intent,
				bold,
			},
		],
	};
}

/** Footer segments for a keymap: each binding's keys and label. */
export function keymapStatusSegments(keymap: Keymap): StatusSegment[] {
	return keymap.map((binding) =>
		hotkeyStatusSegment(binding.action, keyHint(binding), binding.label),
	);
}
