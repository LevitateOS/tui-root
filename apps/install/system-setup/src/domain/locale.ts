/** How a locale writes today's date, a time and a number, from the runtime's own
 * locale data. */

export type LocaleFormats = {
	/** `English`, in the app's own language. */
	language: string;
	/** `United States`; null for a locale with no region. */
	region: string | null;
	/** `Tuesday, November 10, 2026`. */
	date: string;
	/** `2:20 AM`. */
	time: string;
	/** `1,234,567.89`. */
	number: string;
	/** `the week starts on Sunday`; null when the runtime does not know. */
	week: string | null;
};

/** The formats of locale `name` (`en_US.UTF-8`) at `now` in `zone` (the machine's own
 * zone when it is not a zone this runtime knows); null for a name that is no locale. */
export function localeFormats(name: string, now: Date, zone: string | null): LocaleFormats | null {
	const m = /^([a-z]{2,3})(?:_([A-Z]{2}))?(?![A-Za-z])/.exec(name);
	if (!m) return null;
	const [, code, country] = m;
	const tag = country ? `${code}-${country}` : code!;
	try {
		const locale = new Intl.Locale(tag);
		const zoned = (options: Intl.DateTimeFormatOptions) => {
			try {
				return new Intl.DateTimeFormat(tag, { ...options, timeZone: zone ?? undefined }).format(
					now,
				);
			} catch {
				return new Intl.DateTimeFormat(tag, options).format(now);
			}
		};
		// Missing from the TypeScript library the app builds with.
		const { getWeekInfo } = locale as Intl.Locale & { getWeekInfo?: () => { firstDay: number } };
		const first = getWeekInfo?.call(locale).firstDay;
		return {
			language: new Intl.DisplayNames(["en"], { type: "language" }).of(code!) ?? code!,
			region: country
				? (new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? null)
				: null,
			date: zoned({ dateStyle: "full" }),
			time: zoned({ timeStyle: "short" }),
			number: new Intl.NumberFormat(tag).format(1234567.89),
			week:
				first === undefined
					? null
					: `the week starts on ${new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, first)))}`,
		};
	} catch {
		return null;
	}
}
