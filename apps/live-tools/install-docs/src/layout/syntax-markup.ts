import { parseHexColor } from "@levitate/tui-kit";

const ESCAPED_OPEN = "\u0000TUI_ESCAPED_OPEN\u0000";

/** A run of text in one colour, from docs-content's `[[fg=#hex]]…[[/]]` markup. */
export type SyntaxToken = {
	text: string;
	color?: `#${string}`;
};

function restoreEscapes(value: string): string {
	return value.replaceAll(ESCAPED_OPEN, "[[").replaceAll("\\{", "{").replaceAll("\\}", "}");
}

function pushToken(target: SyntaxToken[], token: SyntaxToken): void {
	if (token.text.length === 0) {
		return;
	}
	const previous = target[target.length - 1];
	if (previous && previous.color === token.color) {
		previous.text += token.text;
		return;
	}
	target.push(token);
}

export function parseSyntaxTokenLine(line: string): SyntaxToken[] {
	const source = line.replaceAll("\\[[", ESCAPED_OPEN);
	const tokens: SyntaxToken[] = [];
	let offset = 0;
	let activeColor: `#${string}` | undefined;

	while (offset < source.length) {
		const open = source.indexOf("[[", offset);
		if (open < 0) {
			pushToken(tokens, {
				text: restoreEscapes(source.slice(offset)),
				color: activeColor,
			});
			break;
		}

		if (open > offset) {
			pushToken(tokens, {
				text: restoreEscapes(source.slice(offset, open)),
				color: activeColor,
			});
		}

		const close = source.indexOf("]]", open + 2);
		if (close < 0) {
			pushToken(tokens, {
				text: restoreEscapes(source.slice(open)),
				color: activeColor,
			});
			break;
		}

		const tag = source.slice(open + 2, close).trim();
		if (tag === "/") {
			activeColor = undefined;
		} else if (tag.startsWith("fg=")) {
			const color = parseHexColor(tag.slice(3));
			if (color) {
				activeColor = color;
			}
		}

		offset = close + 2;
	}

	if (tokens.length === 0) {
		return [{ text: restoreEscapes(source) }];
	}

	return tokens;
}
