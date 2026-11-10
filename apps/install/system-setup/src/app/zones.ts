/** Where each time zone is, from the tz database's own tables: the target's, else the
 * live system's (they are the same data; a target mounted elsewhere may lack them). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZonePlaces } from "../domain/zones";

const ZONEINFO = "usr/share/zoneinfo";

function table(root: string, name: string): string {
	for (const base of [root, "/"]) {
		try {
			return readFileSync(join(base, ZONEINFO, name), "utf8");
		} catch {
			// The next place.
		}
	}
	return "";
}

/** `+DDMM+DDDMM` or `+DDMMSS+DDDMMSS`, as degrees north and east. */
function degrees(coordinates: string): { lat: number; lon: number } | null {
	const m = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(coordinates);
	if (!m) return null;
	const part = (sign: string, d: string, min: string, sec = "0") =>
		(sign === "-" ? -1 : 1) * (Number(d) + Number(min) / 60 + Number(sec) / 3600);
	return { lat: part(m[1]!, m[2]!, m[3]!, m[4]), lon: part(m[5]!, m[6]!, m[7]!, m[8]) };
}

/** Every zone the tables place, with its country's name. `zone.tab` names more zones
 * (one a country); `zone1970.tab` fills in what it lacks. */
export function readZonePlaces(root: string): ZonePlaces {
	const countries = new Map<string, string>();
	for (const line of table(root, "iso3166.tab").split("\n")) {
		if (line.startsWith("#")) continue;
		const [code, name] = line.split("\t");
		if (code && name) countries.set(code, name);
	}
	const places: ZonePlaces = new Map();
	for (const file of ["zone.tab", "zone1970.tab"]) {
		for (const line of table(root, file).split("\n")) {
			if (line.startsWith("#")) continue;
			const [codes, coordinates, zone] = line.split("\t");
			const at = coordinates ? degrees(coordinates) : null;
			if (!codes || !zone || !at || places.has(zone)) continue;
			places.set(zone, { ...at, country: countries.get(codes.split(",")[0]!) ?? null });
		}
	}
	return places;
}
