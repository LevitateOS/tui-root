import { keymapHelp } from "@levitate/tui-kit";
import { CONTENT_KEYS, NAV_KEYS, VIEWER_KEYS } from "../presentation/ink/keymap";

export function installDocsCliHelpText(): string {
	return `
LevitateOS Docs TUI

Usage:
  levitate-install-docs
  levitate-install-docs --slug <page-slug>
  levitate-install-docs --slug=<page-slug>
  levitate-install-docs --pages      Print every page slug, one per line
  levitate-install-docs --help

Keys (either pane):
${keymapHelp(VIEWER_KEYS)}

Keys (page list focused):
${keymapHelp(NAV_KEYS)}

Keys (content focused):
${keymapHelp(CONTENT_KEYS)}

Legacy non-interactive flags (--list, --page, --all) were removed.
`;
}
