import { padRight, textWidth } from "../../utils/strings";
import { Text } from "ink";

type KeyValueEntry = {
	key: string;
	value: string;
};

type KeyValueProps = {
	entries: ReadonlyArray<KeyValueEntry>;
};

function renderKeyValue(entries: ReadonlyArray<KeyValueEntry>): string {
	if (entries.length === 0) {
		return "";
	}

	const keyWidth = Math.max(...entries.map((entry) => textWidth(entry.key)));
	return entries.map((entry) => `${padRight(entry.key, keyWidth)} : ${entry.value}`).join("\n");
}

export function KeyValue({ entries }: KeyValueProps) {
	return <Text>{renderKeyValue(entries)}</Text>;
}
