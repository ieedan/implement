import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PACKAGE_DIRS = [
	"core",
	"kit",
	"primitives",
	"formish",
	"lucide",
	"vite",
	"create-implement-app",
] as const;

export type PackageInfo = { name: string; version: string };

/**
 * Reads each workspace package's manifest off disk — data only the server
 * can produce, which is exactly what a load function is for. Runs during the
 * dev SSR and the prerender; the client gets it as `data` (serialized into
 * the page, fetched from `__data.json` on navigation).
 */
export default function load(): { packages: Record<string, PackageInfo> } {
	const packages: Record<string, PackageInfo> = {};
	for (const dir of PACKAGE_DIRS) {
		const manifest = JSON.parse(
			readFileSync(
				fileURLToPath(new URL(`../../../../../packages/${dir}/package.json`, import.meta.url)),
				"utf8",
			),
		) as { name: string; version: string };
		packages[dir] = { name: manifest.name, version: manifest.version };
	}
	return { packages };
}
