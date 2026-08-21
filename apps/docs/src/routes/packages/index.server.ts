import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PACKAGE_DIRS = [
	"core",
	"kit",
	"primitives",
	"lucide",
	"vite",
	"create-implement-app",
] as const;

export type PackageInfo = { name: string; version: string };

function readPackageManifest(path: string, dir: string): PackageInfo {
	const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (raw == null || typeof raw !== "object") {
		throw new Error(`Invalid package.json for ${dir}: expected an object`);
	}
	const { name, version } = raw as Record<string, unknown>;
	if (typeof name !== "string" || typeof version !== "string") {
		throw new Error(`Invalid package.json for ${dir}: "name" and "version" must be strings`);
	}
	return { name, version };
}

/**
 * Reads each workspace package's manifest off disk — data only the server
 * can produce, which is exactly what a load function is for. Runs during the
 * dev SSR and the prerender; the client gets it as `data` (serialized into
 * the page, fetched from `__data.json` on navigation).
 */
export default function load(): { packages: Record<string, PackageInfo> } {
	const packages: Record<string, PackageInfo> = {};
	for (const dir of PACKAGE_DIRS) {
		const path = fileURLToPath(
			new URL(`../../../../../packages/${dir}/package.json`, import.meta.url),
		);
		packages[dir] = readPackageManifest(path, dir);
	}
	return { packages };
}
