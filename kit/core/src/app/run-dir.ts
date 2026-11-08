import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir: string | undefined;

/**
 * This run's own temporary directory, made on first use and removed when the process
 * ends, by exiting or by SIGINT, SIGTERM or SIGHUP. The kit owns the app's lifecycle, so
 * it owns the cleanup; apps put the files they hand their tools here.
 */
export function runDir(app: string): string {
	if (dir) return dir;
	const made = mkdtempSync(join(tmpdir(), `${app}-`));
	dir = made;
	const remove = () => rmSync(made, { recursive: true, force: true });
	process.on("exit", remove);
	for (const [signal, number] of [
		["SIGINT", 2],
		["SIGTERM", 15],
		["SIGHUP", 1],
	] as const) {
		process.once(signal, () => {
			remove();
			process.exit(128 + number);
		});
	}
	return made;
}
