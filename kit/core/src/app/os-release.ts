import { readFileSync } from "node:fs";

/** Points the apps at another os-release (stories, a second distro's look). */
export const OS_RELEASE_ENV = "OS_RELEASE";

/** The running system's os-release text; empty when there is none to read. */
export function readOsRelease(env: Record<string, string | undefined> = process.env): string {
	try {
		return readFileSync(env[OS_RELEASE_ENV]?.trim() || "/etc/os-release", "utf8");
	} catch {
		return "";
	}
}
