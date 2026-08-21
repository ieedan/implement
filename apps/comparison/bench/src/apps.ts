import { resolve } from "node:path";

export type AppId = "implement" | "react" | "svelte";

export type AppTarget = {
	id: AppId;
	/** How the app is labelled in the report. */
	label: string;
	dir: string;
};

const root = resolve(import.meta.dirname, "../..");

export const APPS: AppTarget[] = [
	{ id: "implement", label: "implement", dir: resolve(root, "implement") },
	{ id: "react", label: "React 19", dir: resolve(root, "react") },
	{ id: "svelte", label: "Svelte 5", dir: resolve(root, "svelte") },
];

/** Where the two builds of each app land. */
export const BUILDS = ["dist", "dist-baseline"] as const;

export type BuildId = (typeof BUILDS)[number];

export const RESULTS_DIR = resolve(root, "bench/results");

/**
 * Reports are arrays keyed by app rather than objects keyed by `AppId`, so
 * they can be built up without a cast and still be looked up by id.
 */
export function forApp<T extends { id: AppId }>(entries: T[], id: AppId): T {
	const found = entries.find((entry) => entry.id === id);
	if (found === undefined) throw new Error(`No result recorded for ${id}`);
	return found;
}
