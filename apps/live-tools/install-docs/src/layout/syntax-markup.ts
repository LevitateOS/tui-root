import { parseHexColor } from "@levitate/tui-kit";

/** A run of text in one colour, from docs-content's `[[fg=#hex]]…[[/]]` markup. */
export type SyntaxToken = {
	text: string;
	color?: `#${string}`;
};

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

/**
 * Parses one highlighted line. In text, the docs build writes `\\` for a backslash and
 * `\{`, `\}`, `\[[` for the characters that would otherwise be markup, so a backslash at
 * the end of a token is never mistaken for an escape of the closing tag.
 */
export function parseSyntaxTokenLine(line: string): SyntaxToken[] {
	const tokens: SyntaxToken[] = [];
	let activeColor: `#${string}` | undefined;
	let text = "";

	const flush = (): void => {
		pushToken(tokens, { text, color: activeColor });
		text = "";
	};

	let offset = 0;
	while (offset < line.length) {
		const char = line[offset];
		if (char === "\\") {
			if (line.startsWith("[[", offset + 1)) {
				text += "[[";
				offset += 3;
				continue;
			}
			const next = line[offset + 1];
			if (next === "\\" || next === "{" || next === "}") {
				text += next;
				offset += 2;
				continue;
			}
		} else if (char === "[" && line.startsWith("[[", offset)) {
			const close = line.indexOf("]]", offset + 2);
			if (close >= 0) {
				const tag = line.slice(offset + 2, close).trim();
				flush();
				if (tag === "/") {
					activeColor = undefined;
				} else if (tag.startsWith("fg=")) {
					const color = parseHexColor(tag.slice(3));
					if (color) {
						activeColor = color;
					}
				}
				offset = close + 2;
				continue;
			}
		}
		text += char;
		offset += 1;
	}
	flush();

	return tokens.length === 0 ? [{ text: "" }] : tokens;
}
