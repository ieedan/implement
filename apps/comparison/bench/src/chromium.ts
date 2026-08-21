import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Playwright normally downloads its own Chromium. When the environment already
 * has one (`PLAYWRIGHT_BROWSERS_PATH`), use that instead of failing — and let
 * `CHROMIUM_PATH` override both.
 */
export function chromiumPath(): string | undefined {
	const explicit = process.env.CHROMIUM_PATH;
	if (explicit !== undefined && explicit !== "") return explicit;
	const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
	if (browsers === undefined || !existsSync(browsers)) return undefined;
	for (const entry of readdirSync(browsers)) {
		if (!entry.startsWith("chromium-")) continue;
		const binary = resolve(browsers, entry, "chrome-linux/chrome");
		if (existsSync(binary)) return binary;
	}
	return undefined;
}
