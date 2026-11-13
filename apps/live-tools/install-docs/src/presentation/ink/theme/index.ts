import { brandTheme, type TuiTheme } from "@levitate/tui-kit";
import { brandOf } from "@levitate/docs-content/brand";
import type { Distro } from "@levitate/docs-content/distros";

/** The pane beside the install steps: narrow enough for two panes in half a screen. */
const LAYOUT = { navWidth: 30, minColumns: 70 } as const;

/**
 * The distro's colours with the docs' own widths. As the second pane of the install
 * screen (`pane`) the band is flat: no brand colour and no distro name, so the two panes
 * read as one screen under the first pane's band.
 */
export function createInstallDocsTheme(distro: Distro | undefined, pane: boolean): TuiTheme {
	const brand = brandOf(distro);
	if (!pane) return brandTheme(brand, {}, LAYOUT);
	const { palette } = brand;
	const flat = { ...palette, band: palette.surface, onBand: palette.text };
	return { ...brandTheme({ ...brand, palette: flat }, {}, LAYOUT), brand: "" };
}
