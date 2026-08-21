/**
 * The adapter contract: what `kit({ adapter })` takes, and what an adapter is
 * handed once the build has run.
 *
 * A kit build produces two staged directories under `.implement/output` — the
 * client bundle with everything prerendered into it, and (for an adapter that
 * ships a server) the server bundle. An adapter's job is to turn that pair
 * into whatever its host wants: a directory of files, a Node entry point, a
 * Vercel function, a worker. Nothing about the app is baked into the host
 * glue, which is why the same build feeds all of them.
 *
 * ```ts
 * // vite.config.ts
 * import { kit } from "@implementjs/kit";
 * import node from "@implementjs/adapter-node";
 *
 * export default defineConfig({ plugins: [kit({ adapter: node() })] });
 * ```
 */

export type BuildLogger = {
	info(message: string): void;
	warn(message: string): void;
	error(message: string): void;
};

/** What the prerender wrote into the client directory. */
export type Prerendered = {
	/** Page paths that have a prerendered document (`/`, `/docs/intro`). */
	pages: string[];
	/** Every file the prerender wrote, relative to the client directory. */
	files: string[];
};

/** The app's route table, for adapters that have to describe it to their host. */
export type BuiltRoutes = {
	/** Every page pattern (`/docs/:...slug`). */
	pages: string[];
	/** Every `server.ts` endpoint. */
	endpoints: { pattern: string; extension: string | null }[];
	/** Whether any route has a server load, an endpoint, or hooks. */
	dynamic: boolean;
};

/** How kit should build the server bundle for an adapter. */
export type AdapterBuild = {
	/**
	 * Bundle dependencies into the server output instead of leaving them for
	 * the host's `node_modules`. Hosts that upload a single artifact
	 * (Cloudflare, Vercel) need this; a Node server next to its own
	 * `node_modules` does not. @default false
	 */
	bundle?: boolean;
	/** Vite's `ssr.target` for the server build. @default "node" */
	target?: "node" | "webworker";
	/** Extra `resolve.conditions` for the server build (`"workerd"`, say). */
	conditions?: string[];
	/**
	 * Emit the server as a single file, dynamic imports inlined. @default the
	 * value of `bundle`
	 */
	singleFile?: boolean;
	/**
	 * The module kit builds as the server entry, as source. It stands in for
	 * kit's own entry, which exports the handler and nothing else, and is where
	 * an adapter puts its host glue — a worker's `export default { fetch }`, a
	 * platform's request signature. Import the app through `$implement/handler`:
	 *
	 * ```ts
	 * entry: `
	 * import { handler } from "$implement/handler";
	 * export default { fetch: (request, env, context) => handler(request, { platform: { env, context } }) };
	 * `
	 * ```
	 *
	 * As a function it is called with the finished client build, for glue that
	 * has to carry a fact only the build knows — which paths prerendered, say.
	 */
	entry?: string | ((build: BuildInfo) => string | Promise<string>);
};

/** What the finished client build knows, which both the server entry and the adapter read. */
export type BuildInfo = {
	/** Absolute path of the Vite root — the app's own directory. */
	root: string;
	/** Absolute path of `.implement/output`, which holds the staged build. */
	outDir: string;
	/** Absolute path of the client bundle, with everything prerendered into it. */
	clientDir: string;
	/** Vite's `base`. */
	base: string;
	/** Vite's `build.assetsDir` — where the hashed client chunks live under {@link clientDir}. */
	assetsDir: string;
	/** The built `index.html`, before any page render is injected into it. */
	template: string;
	prerendered: Prerendered;
	routes: BuiltRoutes;
};

/** What an adapter's `adapt` is handed: the finished build, and the tools to move it. */
export type Builder = BuildInfo & {
	/** Absolute path of the server bundle, or `null` for an adapter that ships no server. */
	serverDir: string | null;
	/** The server bundle's entry filename within {@link serverDir}. */
	serverEntry: string;
	log: BuildLogger;
	/** Removes a file or directory, recursively, if it is there at all. */
	rimraf(path: string): void;
	/** Creates a directory and every missing parent. */
	mkdirp(path: string): void;
	/**
	 * Copies a file or directory tree, creating parents as needed.
	 *
	 * @returns the files written, as absolute paths
	 */
	copy(from: string, to: string, options?: { filter?: (path: string) => boolean }): string[];
	/** Writes a file, creating parent directories as needed. */
	writeFile(path: string, contents: string): void;
};

export type Adapter = {
	/** The package name, for build output and error messages. */
	name: string;
	/**
	 * Whether the adapter ships a server. `false` skips the server build
	 * entirely — a static host has nothing to run it with.
	 * @default true
	 */
	server?: boolean;
	/** How the server bundle should be built. Ignored when `server` is `false`. */
	build?: AdapterBuild;
	/** Turns the staged build into the host's deployable shape. */
	adapt(builder: Builder): void | Promise<void>;
};
