/** A time zone as the picker shows it: its clock now, and where it is on a map. */
import { isLand, LAND_NORTH, LAND_SOUTH } from "./land";

export type ZonePlace = { lat: number; lon: number; country: string | null };
export type ZonePlaces = Map<string, ZonePlace>;

export type ZoneClock = {
	/** `14:32`, the time there now. */
	time: string;
	/** `+01:00`, its distance from UTC now. */
	offset: string;
	/** `CET` where the zone has an abbreviation, else as the offset is written. */
	abbreviation: string;
};

/** The zone's clock at `now`; null for a name this system's zone data does not know. */
export function zoneClock(zone: string, now: Date): ZoneClock | null {
	try {
		const parts = (timeZoneName: "longOffset" | "short") =>
			new Intl.DateTimeFormat("en-GB", {
				timeZone: zone,
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23",
				timeZoneName,
			}).formatToParts(now);
		const value = (list: Intl.DateTimeFormatPart[], type: string) =>
			list.find((part) => part.type === type)?.value ?? "";
		const long = parts("longOffset");
		const offset = value(long, "timeZoneName").replace(/^GMT/, "") || "+00:00";
		return {
			time: `${value(long, "hour")}:${value(long, "minute")}`,
			offset,
			abbreviation: value(parts("short"), "timeZoneName"),
		};
	} catch {
		return null;
	}
}

/** A zone's name in two parts: `Europe/` and `Amsterdam`, underscores as spaces. */
export function zoneParts(zone: string): { region: string; city: string } {
	const cut = zone.lastIndexOf("/");
	return {
		region: cut < 0 ? "" : zone.slice(0, cut + 1),
		city: zone.slice(cut + 1).replace(/_/g, " "),
	};
}

/** Where `filter` matches in `name`: at the start of the name or of a part of it when it
 * can, else wherever it first occurs. Null when it does not (or there is no filter). */
export function matchRange(name: string, filter: string): { start: number; end: number } | null {
	const wanted = filter.trim().toLowerCase();
	if (!wanted) return null;
	const lower = name.toLowerCase();
	for (let i = 0; i < lower.length; i++) {
		if ((i === 0 || "/_- ".includes(lower[i - 1]!)) && lower.startsWith(wanted, i))
			return { start: i, end: i + wanted.length };
	}
	const at = lower.indexOf(wanted);
	return at < 0 ? null : { start: at, end: at + wanted.length };
}

/** What a map cell shows: land as dots, a zone that matches the search, or the pin. */
export type MapCell = { text: string; kind: "sea" | "land" | "lit" | "pin" };

/** Braille dots, by row then column of a cell's two by four. */
const DOTS = [
	[0x01, 0x08],
	[0x02, 0x10],
	[0x04, 0x20],
	[0x40, 0x80],
] as const;

/** The map cell a place falls in. */
function cellOf(place: { lat: number; lon: number }, columns: number, rows: number) {
	const row = Math.floor(((LAND_NORTH - place.lat) / (LAND_NORTH - LAND_SOUTH)) * rows);
	const column = Math.floor(((place.lon + 180) / 360) * columns);
	return {
		row: Math.max(0, Math.min(rows - 1, row)),
		column: Math.max(0, Math.min(columns - 1, column)),
	};
}

/**
 * The world as `rows` lines of `columns` cells: land as a field of dots (every other
 * dot, so it reads as texture, not as a block), the cells holding `lit` places marked,
 * and `pin` as one mark.
 */
export function worldMap(
	columns: number,
	rows: number,
	pin: { lat: number; lon: number } | null,
	lit: readonly { lat: number; lon: number }[],
): MapCell[][] {
	const marked = new Set(
		lit.map((place) => cellOf(place, columns, rows)).map((c) => `${c.row},${c.column}`),
	);
	const pinned = pin ? cellOf(pin, columns, rows) : null;
	return Array.from({ length: rows }, (_, row) =>
		Array.from({ length: columns }, (_, column): MapCell => {
			if (pinned && pinned.row === row && pinned.column === column)
				return { text: "●", kind: "pin" };
			let bits = 0;
			for (let dy = 0; dy < 4; dy++) {
				for (let dx = 0; dx < 2; dx++) {
					const lon = -180 + ((column * 2 + dx + 0.5) / (columns * 2)) * 360;
					const lat = LAND_NORTH - ((row * 4 + dy + 0.5) / (rows * 4)) * (LAND_NORTH - LAND_SOUTH);
					if ((column * 2 + dx + row * 4 + dy) % 2 === 0 && isLand(lat, lon))
						bits |= DOTS[dy]![dx]!;
				}
			}
			const isLit = marked.has(`${row},${column}`);
			// A matching zone on an island too small for the bitmap still shows.
			if (!bits) return isLit ? { text: "⠂", kind: "lit" } : { text: " ", kind: "sea" };
			return { text: String.fromCharCode(0x2800 + bits), kind: isLit ? "lit" : "land" };
		}),
	);
}
