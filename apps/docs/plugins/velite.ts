import { join, sep } from "node:path";
import { build } from "velite";
import type { Plugin } from "vite";

const OUTPUT_DIR = ".velite";
const CONTENT_DIR = "src/content";
const CONFIG_FILE = "velite.config.ts";
/** Long enough to collapse a multi-file save into one rebuild. */
const DEBOUNCE_MS = 50;

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

	return {
		name: "velite",
		config: () => ({ server: { watch: { ignored: [`**/${OUTPUT_DIR}/**`] } } }),
		configResolved(config) {
			outputDir = join(config.root, OUTPUT_DIR);
			contentDir = join(config.root, CONTENT_DIR);
			configFile = join(config.root, CONFIG_FILE);
		},
		configureServer(server) {
			const reload = () => server.ws.send({ type: "full-reload" });

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
					const files = [
						join(outputDir, "index.js"),
						...Object.keys(collections).map((name) => join(outputDir, `${name}.json`)),
					];
					for (const environment of Object.values(server.environments)) {
						for (const file of files) {
							for (const mod of environment.moduleGraph.getModulesByFile(file) ?? []) {
								environment.moduleGraph.invalidateModule(mod);
							}
						}
					}
					reload();
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
					if (!stale) {
						reload();
						return;
					}
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
