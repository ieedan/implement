import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { build } from "velite";
import type { Plugin } from "vite";

const OUTPUT_DIR = ".velite";
const CONTENT_DIR = "src/content";
const CONFIG_FILE = "velite.config.ts";
/** Long enough to collapse a multi-file save into one rebuild. */
const DEBOUNCE_MS = 50;

/** A generated file's contents, hashed; `null` when it is not there to read. */
function digest(file: string): string | null {
	try {
		return createHash("sha1").update(readFileSync(file)).digest("hex");
	} catch {
		return null;
	}
}

/**
 * Runs Velite from inside the dev server instead of as a `--watch` process
 * beside it.
 *
 * Velite's watcher starts a rebuild per file event and never serializes them,
 * so a burst of saves has several passes writing `.velite/*.json` at the same
 * time and the files come out interleaved. Vite then fails to parse them —
 * "Unexpected non-whitespace character after JSON" — and the page stays white
 * until the dev server is restarted, because only a restart regenerates the
 * output from scratch. The writes are not atomic either, so even a single
 * pass can be read half-written by Vite's own watcher.
 *
 * Owning the loop closes both: saves debounce into one queued rebuild at a
 * time, Vite is told to ignore `.velite` so a file being written never reaches
 * it, and the generated modules are invalidated by hand once a build has
 * actually finished. `pnpm generate` still writes the first copy before Vite
 * starts, so the dev server never boots against a missing `.velite`.
 */
export function velite(): Plugin {
	let outputDir = "";
	let contentDir = "";
	let configFile = "";
	/** Tail of the rebuild queue — Velite is never running twice at once. */
	let queue: Promise<void> = Promise.resolve();
	/** What each generated file held after the last build, so a rebuild can tell what moved. */
	const digests = new Map<string, string>();

	return {
		name: "velite",
		config: () => ({ server: { watch: { ignored: [`**/${OUTPUT_DIR}/**`] } } }),
		configResolved(config) {
			outputDir = join(config.root, OUTPUT_DIR);
			contentDir = join(config.root, CONTENT_DIR);
			configFile = join(config.root, CONFIG_FILE);
		},
		configureServer(server) {
			// `pnpm generate` wrote the output before Vite booted, so seed the
			// digests from what is on disk: without it the session's first content
			// save looks like every collection changed at once
			try {
				for (const name of readdirSync(outputDir)) {
					if (!name.endsWith(".json") && name !== "index.js") continue;
					const file = join(outputDir, name);
					const hash = digest(file);
					if (hash !== null) digests.set(file, hash);
				}
			} catch {
				// no output yet: the first rebuild seeds it instead
			}

			/**
			 * Hand the rebuilt output to Vite as if its own watcher had seen it.
			 *
			 * Invalidating the modules by hand is only half the job: it drops the
			 * cached transform, but it produces no update for the browser, so the
			 * page has to be reloaded to notice — and a reload on every markdown
			 * save is the thing this app edits most. Emitting the event Vite
			 * listens for runs its normal HMR pass instead, which walks the
			 * importers up to the route module that renders the content and stops
			 * at the boundary kit gives every page and layout. Content edits patch
			 * the route in place; a change that finds no boundary still reloads,
			 * because that is what Vite does when it runs out of importers.
			 *
			 * Only the files whose bytes actually moved go out. Velite rewrites
			 * every collection on every build, and one event per file is one HMR
			 * pass per file — a markdown save re-rendering the route ten times
			 * over, nine of them for collections it did not touch.
			 */
			const publish = (files: string[]) => {
				for (const file of files) {
					const hash = digest(file);
					if (hash === null || digests.get(file) === hash) continue;
					digests.set(file, hash);
					server.watcher.emit("change", file);
				}
			};

			const rebuild = () => {
				queue = queue.then(async () => {
					const started = Date.now();
					let collections: Record<string, unknown>;
					try {
						collections = await build({ config: configFile, clean: false, logLevel: "warn" });
					} catch (error) {
						server.config.logger.error(
							`velite build failed: ${error instanceof Error ? error.message : String(error)}`,
						);
						return;
					}
					// the watcher is ignoring this directory, so nothing else will
					// pick the new content up
					publish([
						join(outputDir, "index.js"),
						...Object.keys(collections).map((name) => join(outputDir, `${name}.json`)),
					]);
					server.config.logger.info(`velite rebuilt content in ${Date.now() - started}ms`);
				});
			};

			let pending: ReturnType<typeof setTimeout> | undefined;
			let stale = false;
			const onChange = (file: string) => {
				if (!file.startsWith(contentDir + sep) && file !== configFile) return;
				// only the markdown Velite reads needs a rebuild; the lesson sources
				// sitting next to it are plain modules Vite serves itself
				stale ||= file.endsWith(".md") || file === configFile;
				clearTimeout(pending);
				pending = setTimeout(() => {
					// a non-markdown file under src/content is a plain module — a
					// lesson's source, read through `?raw` — and Vite is watching it
					// like any other, so its own pass has already handled it
					if (!stale) return;
					stale = false;
					rebuild();
				}, DEBOUNCE_MS);
			};

			server.watcher.on("add", onChange);
			server.watcher.on("change", onChange);
			server.watcher.on("unlink", onChange);
		},
	};
}
