import { Box } from "ink";
import type { InlineNode, RichText } from "@levitate/docs-content";
import {
	appendRun,
	RichTextLine,
	wrapRuns,
	type ColorIntent,
	type RichTextRun,
} from "@levitate/tui-kit";
import type { ReactNode } from "react";

type RichTextRendererProps = {
	content: string | RichText | undefined;
	defaultIntent?: ColorIntent;
	width?: number;
	minimumWidth?: number;
	selectedLinkHref?: string;
};

type LinkRunOptions = {
	href?: string;
	isSelected?: boolean;
	includeHrefWhenDifferent?: boolean;
};

function linkRuns(label: string, options: LinkRunOptions = {}): RichTextRun[] {
	const href = options.href?.trim() ?? "";
	const isSelected = options.isSelected ?? false;
	const includeHref =
		(options.includeHrefWhenDifferent ?? true) && href.length > 0 && href !== label;
	const foregroundIntent = isSelected ? "linkActive" : "link";
	const backgroundIntent = isSelected ? "linkActiveBackground" : undefined;

	const runs: RichTextRun[] = [
		{
			text: label,
			intent: foregroundIntent,
			backgroundIntent,
			underline: true,
			bold: isSelected,
		},
	];

	if (includeHref) {
		runs.push({
			text: ` (${href})`,
			intent: foregroundIntent,
			backgroundIntent,
			bold: false,
		});
	}

	return runs;
}

function plainTextForInlineNode(node: InlineNode): string {
	if (typeof node === "string") {
		return node;
	}
	if (node.type === "link") {
		if (node.href.trim().length > 0 && node.href !== node.text) {
			return `${node.text} (${node.href})`;
		}
		return node.text;
	}
	return node.text;
}

function inlineNodeToRuns(
	node: InlineNode,
	defaultIntent: ColorIntent,
	selectedLinkHref?: string,
): RichTextRun[] {
	if (typeof node === "string") {
		return [{ text: node, intent: defaultIntent }];
	}

	if (node.type === "link") {
		const selectedHref = selectedLinkHref?.trim() ?? "";
		const nodeHref = node.href.trim();
		const isSelectedLink = selectedHref.length > 0 && nodeHref === selectedHref;
		return linkRuns(node.text, {
			href: node.href,
			isSelected: isSelectedLink,
			includeHrefWhenDifferent: true,
		});
	}

	if (node.type === "bold") {
		return [{ text: node.text, intent: defaultIntent, bold: true }];
	}

	if (node.type === "code") {
		return [{ text: node.text, intent: "code" }];
	}

	return [{ text: node.text, intent: defaultIntent, italic: true }];
}

function inlineContentToRuns(
	content: string | RichText | undefined,
	defaultIntent: ColorIntent,
	selectedLinkHref?: string,
): RichTextRun[] {
	if (typeof content === "string") {
		return [{ text: content, intent: defaultIntent }];
	}
	if (!Array.isArray(content)) {
		return [];
	}

	const runs: RichTextRun[] = [];
	for (const node of content) {
		for (const run of inlineNodeToRuns(node, defaultIntent, selectedLinkHref)) {
			appendRun(runs, run);
		}
	}
	return runs;
}

export function inlineContentToPlainText(content: string | RichText | undefined): string {
	if (typeof content === "string") {
		return content;
	}
	if (!Array.isArray(content)) {
		return "";
	}
	return content.map((node) => plainTextForInlineNode(node)).join("");
}

export function wrapRichTextRuns(
	content: string | RichText | undefined,
	width: number,
	defaultIntent: ColorIntent = "text",
	minimumWidth = 1,
	selectedLinkHref?: string,
): RichTextRun[][] {
	return wrapRuns(
		inlineContentToRuns(content, defaultIntent, selectedLinkHref),
		Math.max(minimumWidth, width),
	);
}

export function wrapRichTextPlainLines(
	content: string | RichText | undefined,
	width: number,
	defaultIntent: ColorIntent = "text",
	minimumWidth = 1,
): string[] {
	return wrapRichTextRuns(content, width, defaultIntent, minimumWidth).map((runs) =>
		runs.map((run) => run.text).join(""),
	);
}

export function richTextRuns(
	content: string | RichText | undefined,
	defaultIntent: ColorIntent = "text",
	selectedLinkHref?: string,
): RichTextRun[] {
	return inlineContentToRuns(content, defaultIntent, selectedLinkHref);
}

export function RichTextRenderer({
	content,
	defaultIntent = "text",
	width,
	minimumWidth = 1,
	selectedLinkHref,
}: RichTextRendererProps): ReactNode {
	if (typeof width === "number" && Number.isFinite(width)) {
		const lines = wrapRichTextRuns(content, width, defaultIntent, minimumWidth, selectedLinkHref);
		return (
			<Box flexDirection="column">
				{lines.map((line, index) => (
					<RichTextLine key={`rich-line-${index}`} runs={line} fallbackIntent={defaultIntent} />
				))}
			</Box>
		);
	}

	return (
		<RichTextLine
			runs={inlineContentToRuns(content, defaultIntent, selectedLinkHref)}
			fallbackIntent={defaultIntent}
		/>
	);
}
