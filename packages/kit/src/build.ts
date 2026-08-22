/**
 * The build stage behind `kit({ adapter })`: everything that happens once the
 * client bundle is written and the prerender has run.
 *
 * Kit stages a build into two directories — `.implement/output/client`, the
 * browser bundle with every prerendered page and endpoint written into it, and
 * `.implement/output/server`, the app's request pipeline built for whatever
 * runtime the adapter targets. The adapter then turns that pair into the shape
 * its host deploys. Nothing platform-specific lives here; nothing about the
 * app lives in the adapters.
 *
 * The server build is a second Vite build over the same config, so the app's
 * plugins, aliases, and env replacements apply to it exactly as they do to the
 * client — the difference is only which entry it starts from and what it is
 * allowed to leave external.
 */

import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { build, type ResolvedConfig, type Plugin } from "vite";
import type { Adapter, BuildInfo, Builder, BuiltRoutes } from "./adapter.ts";
import { pageRoutes, serverRoutes } from "./codegen.ts";
import { manifestPath, readManifest, routeAssets } from "./preload.ts";
import type { RouteNode, RouteTree } from "./scan.ts";
import { IMPLEMENT_DIR } from "./typegen.ts";

/** Where a build is staged, relative to the Vite root. */
export const OUTPUT_DIR = `${IMPLEMENT_DIR}/output`;

/** The server bundle's entry filename — fixed, so an adapter can name it without asking. */
const SERVER_ENTRY = "index.js";

/** The module an adapter's own entry imports the built app through. */
const HANDLER_ID = "$implement/handler";
const MANIFEST_ID = "$implement/manifest";

/** What kit builds when the adapter has no host glue of its own to add. */
const DEFAULT_ENTRY = `export { handler, manifest, respond } from "${HANDLER_ID}";\n`;

export type AdapterStageOptions = {
	adapter: Adapter;
	/** The resolved config of the client build that just finished. */
	config: ResolvedConfig;
	/** Absolute path of the client bundle — Vite's `build.outDir` for a kit build. */
	clientDir: string;
	/** The generated server entry, root-relative (`/.implement/entry-server.ts`). */
	entryServer: string;
	tree: RouteTree;
	/** Routes directory relative to the Vite root, leading slash included. */
	routesBase: string;
	/** The page paths the prerender wrote. */
	pages: string[];
	/** Everything else the prerender wrote, as site-root-relative paths. */
	files: string[];
	/** Patterns the pipeline serves that the route scan does not know about (the live OpenAPI route). */
	extraEndpoints?: string[];
};

/**
 * Builds the server bundle (when the adapter ships one) and hands the finished
 * build to the adapter.
 */
export async function runAdapter(options: AdapterStageOptions): Promise<void> {
	const { adapter, config, clientDir, entryServer, tree, pages, files } = options;
	const outDir = resolve(config.root, OUTPUT_DIR);
	const logger = config.logger;
	const info: BuildInfo = {
		root: config.root,
		outDir,
		clientDir,
		base: config.base,
		assetsDir: config.build.assetsDir,
		template: readFileSync(join(clientDir, "index.html"), "utf8"),
		prerendered: { pages, files },
		routes: describeRoutes(tree, options.extraEndpoints ?? []),
	};

	let serverDir: string | null = null;
	if (adapter.server !== false) {
		serverDir = join(outDir, "server");
		await buildServer({ ...options, info, serverDir, entryServer });
		// Vite writes the shell as `index.html`, and to a host that resolves
		// directory indexes that looks like the site's front page. It is not one:
		// it is the empty template the server renders into, and serving it for a
		// path the app was about to render is a blank page instead of the app.
		// The server already carries it in its manifest, and every adapter has it
		// as `builder.template`.
		if (!pages.includes("/")) rmSync(join(clientDir, "index.html"), { force: true });
	}

	const builder: Builder = {
		...info,
		serverDir,
		serverEntry: SERVER_ENTRY,
		log: {
			info: (message) => {
				logger.info(message);
			},
			warn: (message) => {
				logger.warn(message);
			},
			error: (message) => {
				logger.error(message);
			},
		},
		rimraf,
		mkdirp,
		copy,
		writeFile,
	};

	logger.info(`\nrunning ${adapter.name}`);
	await adapter.adapt(builder);
}

/** The app's route table as an adapter sees it. */
function describeRoutes(tree: RouteTree, extraEndpoints: string[]): BuiltRoutes {
	const endpoints = serverRoutes(tree);
	return {
		pages: pageRoutes(tree).map((route) => route.pattern),
		endpoints: [
			...endpoints.map((route) => ({ pattern: route.pattern, extension: route.extension })),
			// the OpenAPI route, when an app mounted a live one — it is served by
			// the same pipeline, so a host routing by pattern has to know about it
			...extraEndpoints.map((pattern) => ({ pattern, extension: null })),
		],
		dynamic: endpoints.length > 0 || extraEndpoints.length > 0 || hasServerLoads(tree.root),
	};
}

function hasServerLoads(node: RouteNode): boolean {
	return (
		node.pageServer !== null || node.layoutServer !== null || node.children.some(hasServerLoads)
	);
}

/**
 * The second Vite build: the app's pipeline, from the adapter's entry or kit's
 * own, with the finished client build's shell and chunk names baked into the
 * manifest it carries.
 */
async function buildServer(options: {
	adapter: Adapter;
	config: ResolvedConfig;
	info: BuildInfo;
	serverDir: string;
	entryServer: string;
	tree: RouteTree;
	routesBase: string;
}): Promise<void> {
	const { adapter, config, info, serverDir, entryServer, tree, routesBase } = options;
	const settings = adapter.build ?? {};
	const bundle = settings.bundle ?? false;
	const singleFile = settings.singleFile ?? bundle;

	const assets = routeAssets({
		manifest: readManifest(manifestPath(info.clientDir, config.build.manifest)),
		routesBase,
		tree,
	});
	const manifest = { base: config.base, template: info.template, assets };

	// the entry is a real file rather than a virtual module so that Rollup has
	// something to name the bundle after, and so an adapter's glue shows up in
	// a stack trace as a file you can open
	const entryFile = join(info.outDir, `entry-${sanitize(adapter.name)}.js`);
	const entry = settings.entry;
	writeFile(entryFile, (typeof entry === "function" ? await entry(info) : entry) ?? DEFAULT_ENTRY);

	const virtuals: Plugin = {
		name: "implement-kit:adapter-modules",
		enforce: "pre",
		resolveId(id) {
			if (id === HANDLER_ID) return `\0${HANDLER_ID}`;
			if (id === MANIFEST_ID) return `\0${MANIFEST_ID}`;
			return null;
		},
		load(id) {
			if (id === `\0${MANIFEST_ID}`) {
				return `export const manifest = ${JSON.stringify(manifest)};\n`;
			}
			if (id !== `\0${HANDLER_ID}`) return null;
			return [
				'import { createHandler } from "@implementjs/kit/handler";',
				`import { manifest } from "${MANIFEST_ID}";`,
				`import { respond } from "${entryServer}";`,
				"",
				"export { manifest, respond };",
				"export const handler = createHandler({ respond }, manifest);",
				"",
			].join("\n");
		},
	};

	const conditions = settings.conditions;
	// the server build is the same app: same config file, same inline options,
	// same plugins. Only the entry, the output, and what may stay external
	// differ — anything else and the two halves resolve modules differently
	const { build: _clientBuild, plugins: inlinePlugins, ...inline } = config.inlineConfig;
	await build({
		...inline,
		configFile: config.configFile ?? false,
		root: config.root,
		mode: config.mode,
		logLevel: "warn",
		plugins: [inlinePlugins ?? [], virtuals],
		...(conditions === undefined ? {} : { resolve: { conditions } }),
		ssr: {
			target: settings.target ?? "node",
			// kit's own runtime always comes along: an adapter's output is
			// deployed on its own, and a workspace link is not a dependency the
			// host will install
			noExternal: bundle ? true : [/^@implementjs\//],
			...(conditions === undefined ? {} : { resolve: { conditions } }),
		},
		build: {
			ssr: entryFile,
			outDir: serverDir,
			emptyOutDir: true,
			manifest: false,
			copyPublicDir: false,
			rollupOptions: {
				output: {
					entryFileNames: SERVER_ENTRY,
					chunkFileNames: "chunks/[name]-[hash].js",
					inlineDynamicImports: singleFile,
				},
			},
		},
	});
}

/** A name safe to use as a filename — adapters are package names, slashes and all. */
function sanitize(name: string): string {
	return name.replaceAll(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// The filesystem helpers every adapter needs
// ---------------------------------------------------------------------------

export function rimraf(path: string): void {
	rmSync(path, { recursive: true, force: true });
}

export function mkdirp(path: string): void {
	mkdirSync(path, { recursive: true });
}

export function writeFile(path: string, contents: string): void {
	mkdirp(dirname(path));
	writeFileSync(path, contents);
}

/**
 * Copies a file or a whole tree, and reports what it wrote. A filter sees each
 * path as it is reached, so skipping a directory skips everything under it.
 */
export function copy(
	from: string,
	to: string,
	options: { filter?: (path: string) => boolean } = {},
): string[] {
	const filter = options.filter ?? (() => true);
	const written: string[] = [];

	// directories are made on the way to a file, never up front — an adapter
	// that copies only the documents out of a tree should not be left with the
	// empty shape of everything it skipped
	const walk = (source: string, target: string) => {
		if (!filter(source)) return;
		if (statSync(source).isDirectory()) {
			for (const entry of readdirSync(source)) walk(join(source, entry), join(target, entry));
			return;
		}
		mkdirp(dirname(target));
		cpSync(source, target);
		written.push(target);
	};

	if (!existsSync(from)) return written;
	walk(from, to);
	return written;
}

/** A path as the site serves it: root-relative, POSIX separators, leading slash. */
export function sitePath(dir: string, file: string): string {
	return `/${relative(dir, file).replaceAll("\\", "/")}`;
}
