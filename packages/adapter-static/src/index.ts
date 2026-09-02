import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { assertNoSockets, type Adapter, type Builder } from "@implementjs/kit/adapter";

export type StaticAdapterOptions = {
	/** Where the prerendered documents go, relative to the app. @default "dist" */
	pages?: string;
	/** Where everything else goes, relative to the app. @default the value of `pages` */
	assets?: string;
	/**
	 * A document written for every path the build has no file for — the SPA
	 * shell, unrendered, so the client router takes over. Pair it with
	 * `kit({ prerender: false })` for a pure single-page app, or point a host's
	 * not-found rule at it.
	 *
	 * An app with a root `error.ts` already gets a rendered `404.html`, which
	 * is what most static hosts serve on their own.
	 */
	fallback?: string;
	/** Also write `.gz` and `.br` copies of every compressible file. @default false */
	precompress?: boolean;
	/**
	 * Fail the build when a route cannot be a file — a page or endpoint that
	 * nothing prerendered has no way to answer on a static host, and shipping
	 * it silently means a 404 in production and nothing in the build log.
	 * A `fallback` turns this off on its own: with one, the client router is
	 * what answers a path the build has no document for.
	 * @default true
	 */
	strict?: boolean;
};

/** What compresses usefully; images and fonts are already compressed. */
const COMPRESSIBLE = new Set([
	".css",
	".html",
	".js",
	".json",
	".map",
	".md",
	".svg",
	".txt",
	".wasm",
	".webmanifest",
	".xml",
]);

/**
 * Writes the build out as plain files, for a static host — GitHub Pages, S3, a
 * CDN, `python -m http.server`. Nothing runs at request time, so every page has
 * to exist as a document, which is what kit's prerender does by default with
 * this adapter in place.
 *
 * ```ts
 * // vite.config.ts
 * import { kit } from "@implementjs/kit";
 * import adapter from "@implementjs/adapter-static";
 *
 * export default defineConfig({ plugins: [kit({ adapter: adapter() })] });
 * ```
 *
 * A single-page app is the same adapter with the prerender off and a fallback
 * document for the client router to boot from:
 *
 * ```ts
 * kit({ prerender: false, adapter: adapter({ fallback: "index.html" }) });
 * ```
 */
export default function adapter(options: StaticAdapterOptions = {}): Adapter {
	const pagesDir = options.pages ?? "dist";
	const assetsDir = options.assets ?? pagesDir;
	const strict = options.strict ?? true;

	return {
		name: "@implementjs/adapter-static",
		// nothing to run means nothing to build a server from
		server: false,
		adapt(builder) {
			const pages = join(builder.root, pagesDir);
			const assets = join(builder.root, assetsDir);

			// unconditional, `strict` and `fallback` notwithstanding: those are
			// about a path a document could have covered, and nothing a static host
			// serves can answer an upgrade
			assertNoSockets(
				builder,
				"@implementjs/adapter-static",
				"a static host has nothing running to hold a socket open",
			);

			// a fallback answers every path the build has no file for, so there is
			// nothing left for this to catch
			if (strict && options.fallback === undefined) validate(builder);

			builder.rimraf(assets);
			builder.rimraf(pages);
			builder.copy(builder.clientDir, assets);
			if (assets !== pages) {
				// the split exists for hosts that serve documents and assets from
				// different places; the documents are the html
				builder.copy(builder.clientDir, pages, {
					filter: (path) => statSync(path).isDirectory() || path.endsWith(".html"),
				});
			}

			if (options.fallback !== undefined) {
				builder.writeFile(join(pages, options.fallback), builder.template);
			}

			if (options.precompress === true) {
				const compressed = precompress(assets) + (assets === pages ? 0 : precompress(pages));
				builder.log.info(`precompressed ${compressed} files`);
			}

			builder.log.info(
				`wrote ${builder.prerendered.pages.length} pages to ${relative(builder.root, pages)}`,
			);
		},
	};
}

/**
 * What a static host cannot answer. Params are exempt: a `[slug]` page only
 * exists at the paths the prerender was given, and the app knows which those
 * are — a pattern with no file is how every unlisted one looks from here.
 */
function validate(builder: Builder): void {
	const prerendered = new Set(builder.prerendered.pages);
	const files = new Set(builder.prerendered.files);
	const missing = [
		...builder.routes.pages
			.filter((pattern) => !pattern.includes(":") && !prerendered.has(pattern))
			.map((pattern) => `page ${pattern}`),
		...builder.routes.endpoints
			.filter((route) => !route.pattern.includes(":"))
			.filter((route) => !files.has(endpointPath(route.pattern, route.extension)))
			.map((route) => `endpoint ${endpointPath(route.pattern, route.extension)}`),
	];
	if (missing.length === 0) return;
	throw new Error(
		[
			"@implementjs/adapter-static: nothing prerendered these, and a static host has no way to answer them:",
			...missing.map((entry) => `  ${entry}`),
			"",
			"Prerender them (`export const prerender = true`, or add the path to",
			"`kit({ prerender: { entries } })`), serve them from a server adapter,",
			"or pass `strict: false` to ship the build without them.",
		].join("\n"),
	);
}

function endpointPath(pattern: string, extension: string | null): string {
	if (extension === null) return pattern;
	return pattern === "/" ? `/${extension}` : `${pattern}${extension}`;
}

/** Writes a `.gz` and a `.br` beside every compressible file in a tree. */
function precompress(dir: string): number {
	let written = 0;
	const walk = (path: string) => {
		if (statSync(path).isDirectory()) {
			for (const entry of readdirSync(path)) walk(join(path, entry));
			return;
		}
		if (!COMPRESSIBLE.has(extname(path))) return;
		const contents = readFileSync(path);
		writeFileSync(`${path}.gz`, gzipSync(contents, { level: 9 }));
		writeFileSync(
			`${path}.br`,
			brotliCompressSync(contents, {
				params: {
					[constants.BROTLI_PARAM_QUALITY]: 11,
					[constants.BROTLI_PARAM_SIZE_HINT]: contents.byteLength,
				},
			}),
		);
		written++;
	};
	walk(dir);
	return written;
}
