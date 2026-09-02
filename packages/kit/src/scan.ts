import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILTIN_MATCHER_NAMES } from "./params.ts";

export const PAGE_FILE = "page.ts";
export const LAYOUT_FILE = "layout.ts";
export const ERROR_FILE = "error.ts";
export const ENDPOINT_FILE = "server.ts";
export const PAGE_SERVER_FILE = "page.server.ts";
export const LAYOUT_SERVER_FILE = "layout.server.ts";

export type RouteSegment =
	| { kind: "static"; value: string }
	/** `[id]`, or `[id=integer]` with the name of the matcher gating it. */
	| { kind: "param"; name: string; matcher: string | null }
	/** `[...slug]`, or `[...slug=path]` — the matcher sees the joined remainder. */
	| { kind: "rest"; name: string; matcher: string | null }
	| { kind: "group"; name: string };

/** A route param with the matcher gating it, as a route's `$types` need it. */
export type RouteParam = { name: string; matcher: string | null };

export type RouteNode = {
	/** Directory path relative to the routes dir, `""` for the root. */
	dir: string;
	segment: RouteSegment | null;
	/** Params accumulated from the root down to (and including) this segment. */
	params: RouteParam[];
	/** Relative path of this directory's page (`page.ts` or `page@<target>.ts`), when present. */
	page: string | null;
	/**
	 * Layout-reset target of a `page@<target>.ts` page: `""` resets to the
	 * root layout, `"(name)"`/`"segment"` to that ancestor directory's level.
	 * `null` when the page inherits normally.
	 */
	pageResetTo: string | null;
	/** Relative path of this directory's layout (`layout.ts` or `layout@<target>.ts`), when present. */
	layout: string | null;
	/** Layout-reset target of a `layout@<target>.ts` layout; `null` when it inherits normally. */
	layoutResetTo: string | null;
	/** Relative path of this directory's `page.server.ts` load, when present. */
	pageServer: string | null;
	/** Relative path of this directory's `layout.server.ts` load, when present. */
	layoutServer: string | null;
	/** Relative path of this directory's `server.ts` endpoint, when present. */
	endpoint: string | null;
	/** Whether that `server.ts` exports a `SOCKET` handler. See {@link exportsSocket}. */
	endpointSocket: boolean;
	/**
	 * Relative path of this directory's `error.ts`, when present — the error
	 * page for everything routed at or below it.
	 */
	error: string | null;
	/**
	 * Extension endpoints from `.<ext>` child directories holding a
	 * `server.ts` — `.md/server.ts` serves this directory's path + `.md`.
	 */
	extensions: ExtensionEndpoint[];
	children: RouteNode[];
};

export type ExtensionEndpoint = {
	/** The extension the endpoint appends to the directory's path, dot included (`".md"`). */
	extension: string;
	/** Relative path of the `.<ext>/server.ts` file. */
	file: string;
	/** Whether that `server.ts` exports a `SOCKET` handler. See {@link exportsSocket}. */
	socket: boolean;
};

/**
 * Something the scan noticed that is worth saying out loud but is not an error
 * — the tree is the same either way. It is what the dev server, the build, and
 * `implement-kit sync` warn about.
 */
export type RouteWarning =
	/**
	 * A file in the routes tree that reads like a routing file but is not one —
	 * `+server.ts` next to the `server.ts` kit was waiting for.
	 */
	| {
			kind: "unknown-file";
			/** Path of the file relative to the routes dir. */
			file: string;
			/** The routing file name it was most likely reaching for. */
			suggestion: string;
	  }
	/**
	 * A `layout.server.ts` annotating its load with `LoadEvent`, which belongs
	 * to the page load one directory level down the chain. See
	 * {@link importsLoadEvent}.
	 */
	| {
			kind: "layout-load-event";
			/** Path of the `layout.server.ts` relative to the routes dir. */
			file: string;
	  };

export type RouteTree = {
	root: RouteNode;
	/**
	 * Relative path of the root `error.ts`, when present — the boundary every
	 * path falls inside, and the one the prerendered `404.html` renders. Every
	 * other `error.ts` hangs off the node whose subtree it covers.
	 */
	error: string | null;
	/** Near-miss file names found anywhere in the tree, in scan order. */
	warnings: RouteWarning[];
	/**
	 * The param matchers the app declares, sorted: one name per
	 * `<params>/<name>.ts`, which is the name a `[param=<name>]` directory uses.
	 */
	matchers: string[];
};

/**
 * `[...slug]` → rest, `[id]` → param, `(name)` → group, anything else →
 * static. A `=<name>` suffix inside the brackets names the param matcher
 * gating the segment: `[id=integer]`, `[...slug=path]`.
 */
export function parseSegment(name: string): RouteSegment {
	if (name.startsWith("[") || name.endsWith("]")) {
		const match = /^\[(\.\.\.)?([^[\]./=]+)(?:=([^[\]./=]+))?\]$/.exec(name);
		if (!match) {
			throw new Error(
				`Invalid route directory name "${name}" — expected [param], [...rest], or either with a =matcher`,
			);
		}
		const matcher = match[3] ?? null;
		return match[1]
			? { kind: "rest", name: match[2]!, matcher }
			: { kind: "param", name: match[2]!, matcher };
	}
	if (name.startsWith("(") || name.endsWith(")")) {
		const match = /^\(([^()/@]+)\)$/.exec(name);
		if (!match) {
			throw new Error(`Invalid route directory name "${name}" — expected (group)`);
		}
		return { kind: "group", name: match[1]! };
	}
	if (name.includes(":")) {
		throw new Error(`Invalid route directory name "${name}" — ":" is reserved`);
	}
	return { kind: "static", value: name };
}

type RouteFileInfo = { kind: "page" | "layout"; resetTo: string | null };

/**
 * `page.ts`/`layout.ts` → plain page/layout; `page@<target>.ts` /
 * `layout@<target>.ts` → the same with a layout reset (`@` alone targets the
 * root). Anything else is not a routing file.
 */
export function parseRouteFileName(name: string): RouteFileInfo | null {
	if (name === PAGE_FILE) return { kind: "page", resetTo: null };
	if (name === LAYOUT_FILE) return { kind: "layout", resetTo: null };
	const match = /^(page|layout)@(.*)\.ts$/.exec(name);
	if (!match) return null;
	return { kind: match[1] === "page" ? "page" : "layout", resetTo: match[2]! };
}

/** Whether a filename participates in routing (including `@` reset variants, server files, and `error.ts`). */
export function isRouteFileName(name: string): boolean {
	return (
		name === ERROR_FILE ||
		name === ENDPOINT_FILE ||
		name === PAGE_SERVER_FILE ||
		name === LAYOUT_SERVER_FILE ||
		parseRouteFileName(name) !== null
	);
}

/**
 * The extensions a routing file gets written with by mistake. Kit's own is
 * `.ts`; the rest are the habits of the frameworks people arrive from.
 */
const SOURCE_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".mts",
	".cts",
	".svelte",
	".vue",
]);

/**
 * The routing file a name was probably reaching for, or `null` when it is
 * ordinary colocated code: `+server.ts` → `server.ts`, `page.tsx` → `page.ts`,
 * `+page.server.js` → `page.server.ts`. Only near misses count — a name that
 * becomes a routing file once a `+` prefix comes off and the extension is
 * kit's — so `Button.ts`, `layout.css`, and `page.test.ts` stay silent.
 */
export function routeFileSuggestion(name: string): string | null {
	if (isRouteFileName(name)) return null;
	const dot = name.lastIndexOf(".");
	if (dot <= 0) return null;
	if (!SOURCE_EXTENSIONS.has(name.slice(dot).toLowerCase())) return null;
	const candidate = `${name.slice(0, dot).replace(/^\+/, "")}.ts`;
	return candidate !== name && isRouteFileName(candidate) ? candidate : null;
}

/**
 * The named bindings of every `import … from "./$types"` in a module, as the
 * text between the braces. Both spellings are here because either is how a
 * route file names its event: `import type { X }` and `import { type X }`.
 */
const TYPES_IMPORT = /\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*(["'])\.\/\$types\2/g;

/**
 * Whether a module imports `LoadEvent` from its own `./$types`.
 *
 * Which is fine in a `page.server.ts` and circular in a `layout.server.ts`: a
 * route's `$types` exports one load event per file that can load, and
 * `LoadEvent` — the page's — carries the data of every load above the page,
 * this directory's own layout load included. A layout load annotated with it
 * is therefore referenced in its own type, which is what `TS2502` is reporting
 * when it names the destructured parameter and nothing else.
 *
 * Read rather than parsed, because the question is narrow enough to answer off
 * the import clause: the specifier is the literal `./$types`, and an alias
 * (`LoadEvent as Event`) renames the local, not what was imported.
 */
export function importsLoadEvent(source: string): boolean {
	for (const match of source.matchAll(TYPES_IMPORT)) {
		for (const specifier of match[1]!.split(",")) {
			if (
				specifier
					.replace(/^\s*type\s+/, "")
					.split(/\s+as\s+/, 1)[0]!
					.trim() === "LoadEvent"
			) {
				return true;
			}
		}
	}
	return false;
}

/** `export const SOCKET`, and the other four ways to declare one. */
const SOCKET_DECLARATION = /\bexport\s+(?:const|let|var|(?:async\s+)?function\s*\*?)\s+SOCKET\b/;

/** The braces of every `export { … }` clause, re-export or not. */
const NAMED_EXPORTS = /\bexport\s*\{([^}]*)\}/g;

/**
 * Whether a `server.ts` exports a `SOCKET` handler.
 *
 * Read rather than evaluated, for the same reason {@link importsLoadEvent} is:
 * the scan builds the route tree from names on disk, and loading an endpoint
 * module to answer one question would drag the app's database driver into
 * every `vite.config.ts` that scans a route tree.
 *
 * The answer is used at build time only — to tell an adapter that cannot hold
 * a connection open that this app is asking it to, before it deploys something
 * that would 404 at runtime. Dispatch reads the real module, so a socket route
 * this misses still serves; a route it invents would be refused a deploy it
 * could have had, which is why the patterns below are the exact five ways a
 * module can name an export and nothing looser.
 */
export function exportsSocket(source: string): boolean {
	if (SOCKET_DECLARATION.test(source)) return true;
	for (const match of source.matchAll(NAMED_EXPORTS)) {
		for (const specifier of match[1]!.split(",")) {
			// `x as SOCKET` exports `SOCKET`; `SOCKET as x` does not
			const parts = specifier.split(/\s+as\s+/);
			if (parts[parts.length - 1]!.trim() === "SOCKET") return true;
		}
	}
	return false;
}

/**
 * A route file's source, or `""` when it will not read. Nothing but a warning
 * hangs on the answer, so a file that vanished between the readdir and the read
 * is one there is nothing to say about rather than a failed scan.
 */
function readSource(file: string): string {
	try {
		return readFileSync(file, "utf8");
	} catch {
		return "";
	}
}

/**
 * How a warning reads in the terminal. A near miss says why the file did
 * nothing as well as what to call it — a misnamed route is invisible otherwise,
 * which is the whole reason the warning exists. A layout load typed with
 * `LoadEvent` says the one word `TS2502` never gets to.
 */
export function formatRouteWarning(warning: RouteWarning, routes: string): string {
	if (warning.kind === "layout-load-event") {
		return `"${routes}/${warning.file}" imports LoadEvent from "./$types" — a layout.server.ts load takes LayoutLoadEvent. LoadEvent belongs to the page load and carries the data of every load above the page, this layout's own included, so a layout load annotated with it is referenced in its own type. That is the TS2502 tsc reports at the load's parameter.`;
	}
	return `unknown file "${routes}/${warning.file}" — did you mean "${warning.suggestion}"? Anything else in the routes tree is colocated code, so this file routes nothing.`;
}

/** `.md`, `.json`, `.tar.gz` — a dot-directory naming the extension its `server.ts` serves. */
const EXTENSION_DIR = /^(\.[a-z0-9]+)+$/i;

/**
 * Every `<params>/<name>.ts` in the app, sorted — the matchers a
 * `[param=<name>]` directory may name. A params directory that does not exist
 * is simply an app with no matchers.
 */
export function scanMatchers(paramsDir: string | null): string[] {
	if (paramsDir === null || !existsSync(paramsDir)) return [];
	return readdirSync(paramsDir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
		.map((entry) => entry.name.slice(0, -".ts".length))
		.filter((name) => name !== "")
		.toSorted((a, b) => a.localeCompare(b));
}

/**
 * Scans a routes directory into a tree of pages and layouts. Only `page.ts`,
 * `layout.ts`, their `@` layout-reset variants, the server files
 * (`page.server.ts` / `layout.server.ts` loads and `server.ts` endpoints),
 * and `error.ts` are routing files — anything else is colocated code
 * and ignored. Dot-directories are skipped, except `.<ext>` directories
 * holding a `server.ts`, which serve the parent path with the extension
 * appended. `(group)` directories scope layouts without contributing a URL
 * segment.
 *
 * `paramsDir` is where the app's param matchers live (`src/params`). A
 * `[param=<name>]` directory naming a matcher that is not in there is a scan
 * error, so a typo'd matcher is caught when the route tree is read rather than
 * when a request happens to reach the route.
 */
export function scanRoutes(routesDir: string, paramsDir: string | null = null): RouteTree {
	const matchers = scanMatchers(paramsDir);
	// collected into one array as the walk goes, so a near miss is still
	// reported from a directory the scan drops for having no routes in it —
	// which is exactly the directory holding nothing but a misnamed file
	const warnings: RouteWarning[] = [];
	const root = scanDirectory(routesDir, "", null, [], warnings);
	const tree: RouteTree = { root, error: root.error, warnings, matchers };
	assertUniquePatterns(tree.root);
	assertMatchersExist(tree.root, matchers);
	return tree;
}

function scanDirectory(
	routesDir: string,
	dir: string,
	segment: RouteSegment | null,
	params: RouteParam[],
	warnings: RouteWarning[],
): RouteNode {
	const node: RouteNode = {
		dir,
		segment,
		params,
		page: null,
		pageResetTo: null,
		layout: null,
		layoutResetTo: null,
		pageServer: null,
		layoutServer: null,
		endpoint: null,
		endpointSocket: false,
		error: null,
		extensions: [],
		children: [],
	};
	const absolute = dir === "" ? routesDir : join(routesDir, dir);
	const entries = readdirSync(absolute, { withFileTypes: true }).toSorted((a, b) =>
		a.name.localeCompare(b.name),
	);

	for (const entry of entries) {
		const relative = dir === "" ? entry.name : `${dir}/${entry.name}`;
		if (entry.isFile()) {
			if (entry.name === ERROR_FILE) {
				node.error = relative;
				continue;
			}
			if (entry.name === ENDPOINT_FILE) {
				node.endpoint = relative;
				// which adapters may deploy this app depends on it, and nothing else
				// in the tree can say — see `exportsSocket`
				node.endpointSocket = exportsSocket(readSource(join(absolute, entry.name)));
				continue;
			}
			if (entry.name === PAGE_SERVER_FILE) {
				node.pageServer = relative;
				continue;
			}
			if (entry.name === LAYOUT_SERVER_FILE) {
				node.layoutServer = relative;
				// the only routing file whose *contents* are worth a word: it is the
				// one place `LoadEvent` compiles nowhere and says nothing about why
				if (importsLoadEvent(readSource(join(absolute, entry.name)))) {
					warnings.push({ kind: "layout-load-event", file: relative });
				}
				continue;
			}
			const info = parseRouteFileName(entry.name);
			if (info === null) {
				const suggestion = routeFileSuggestion(entry.name);
				if (suggestion !== null) {
					warnings.push({ kind: "unknown-file", file: relative, suggestion });
				}
				continue;
			}
			if (info.resetTo !== null) validateResetTarget(info, dir, relative);
			if (info.kind === "page") {
				if (node.page !== null) {
					throw new Error(
						`"${relative}" conflicts with "${node.page}" — a directory declares one page`,
					);
				}
				node.page = relative;
				node.pageResetTo = info.resetTo;
			} else {
				if (node.layout !== null) {
					throw new Error(
						`"${relative}" conflicts with "${node.layout}" — a directory declares one layout`,
					);
				}
				node.layout = relative;
				node.layoutResetTo = info.resetTo;
			}
			continue;
		}
		if (!entry.isDirectory()) continue;
		if (entry.name.startsWith(".")) {
			// a `.<ext>` directory holding a server.ts serves this directory's
			// path with the extension appended; any other dot-directory is skipped
			if (
				EXTENSION_DIR.test(entry.name) &&
				readdirSync(join(absolute, entry.name), { withFileTypes: true }).some(
					(child) => child.isFile() && child.name === ENDPOINT_FILE,
				)
			) {
				node.extensions.push({
					extension: entry.name,
					file: `${relative}/${ENDPOINT_FILE}`,
					socket: exportsSocket(readSource(join(absolute, entry.name, ENDPOINT_FILE))),
				});
			}
			continue;
		}

		const childSegment = parseSegment(entry.name);
		if (childSegment.kind === "param" || childSegment.kind === "rest") {
			if (params.some((param) => param.name === childSegment.name)) {
				throw new Error(`Duplicate route param "${childSegment.name}" at "${relative}"`);
			}
		}
		const childParams =
			childSegment.kind === "param" || childSegment.kind === "rest"
				? [...params, { name: childSegment.name, matcher: childSegment.matcher }]
				: params;
		const child = scanDirectory(routesDir, relative, childSegment, childParams, warnings);
		if (!hasRouteFiles(child)) continue;
		// a rest segment swallows the rest of the path — nothing can route below it
		if (segmentIsRest(segment)) {
			throw new Error(
				`"${relative}" — a [...${segment.name}] directory cannot contain nested routes`,
			);
		}
		node.children.push(child);
	}

	if (node.endpoint !== null && node.page !== null) {
		throw new Error(
			`"${node.endpoint}" conflicts with "${node.page}" — a directory serves a page or an endpoint, not both`,
		);
	}
	if (node.pageServer !== null && node.page === null) {
		throw new Error(
			`"${node.pageServer}" has no "${dir === "" ? "" : `${dir}/`}page.ts" page to load for`,
		);
	}

	return node;
}

/**
 * An `@` target must name an ancestor directory segment (a page may also name
 * its own directory, keeping that directory's layout); `@` alone targets the
 * root.
 */
function validateResetTarget(info: RouteFileInfo, dir: string, relative: string): void {
	const names = dir === "" ? [] : dir.split("/");
	// a layout resets what it inherits, so its own directory is not a valid target
	const candidates = info.kind === "page" ? names : names.slice(0, -1);
	if (info.resetTo === "") {
		if (info.kind === "layout" && dir === "") {
			throw new Error(`"${relative}" — the root layout has nothing to reset to`);
		}
		return;
	}
	if (!candidates.includes(info.resetTo!)) {
		throw new Error(
			`"${relative}" — no ancestor segment "${info.resetTo}" to reset to (use "@" for the root)`,
		);
	}
}

function segmentIsRest(
	segment: RouteSegment | null,
): segment is Extract<RouteSegment, { kind: "rest" }> {
	return segment !== null && segment.kind === "rest";
}

/** Whether the subtree contributes any routing (a page, layout, load, endpoint, or error page somewhere). */
export function hasRouteFiles(node: RouteNode): boolean {
	return (
		node.page !== null ||
		node.layout !== null ||
		node.error !== null ||
		node.layoutServer !== null ||
		node.endpoint !== null ||
		node.extensions.length > 0 ||
		node.children.some(hasRouteFiles)
	);
}

/**
 * The URL-pattern contribution of a segment: `/docs`, `/:id`, `/:...slug`, or
 * either param form with the matcher gating it — `/:id=integer`. `(group)`
 * segments contribute nothing.
 */
export function segmentKey(segment: RouteSegment): string {
	if (segment.kind === "static") return `/${segment.value}`;
	if (segment.kind === "group") return "";
	const suffix = segment.matcher === null ? "" : `=${segment.matcher}`;
	return segment.kind === "rest" ? `/:...${segment.name}${suffix}` : `/:${segment.name}${suffix}`;
}

/**
 * Every `[param=<name>]` in the tree names a matcher the app actually has.
 * Checked over the whole tree at once so the message can list what is there.
 */
function assertMatchersExist(root: RouteNode, matchers: string[]): void {
	// a built-in needs no file, so it is known whether or not the app wrote one
	const known = new Set([...matchers, ...BUILTIN_MATCHER_NAMES]);
	const walk = (node: RouteNode) => {
		const segment = node.segment;
		if (
			segment !== null &&
			(segment.kind === "param" || segment.kind === "rest") &&
			segment.matcher !== null &&
			!known.has(segment.matcher)
		) {
			const available =
				matchers.length === 0
					? `the app declares no param matchers, and the built-in ones are ${BUILTIN_MATCHER_NAMES.join(", ")}`
					: `the ones it declares are ${matchers.join(", ")}, and the built-in ones are ${BUILTIN_MATCHER_NAMES.join(", ")}`;
			throw new Error(
				`"${node.dir}" names the param matcher "${segment.matcher}", but there is no "${segment.matcher}.ts" in the params directory — ${available}`,
			);
		}
		for (const child of node.children) walk(child);
	};
	walk(root);
}

/** The URL pattern an extension endpoint serves: its directory's pattern with the extension appended. */
export function extensionPattern(pattern: string, extension: string): string {
	return pattern === "/" ? `/${extension}` : `${pattern}${extension}`;
}

/** Since `(group)` directories vanish from the URL, distinct routes can collide on one path. */
function assertUniquePatterns(root: RouteNode): void {
	const seen = new Map<string, string>();
	const claim = (pattern: string, file: string) => {
		const existing = seen.get(pattern);
		if (existing !== undefined) {
			throw new Error(`"${existing}" and "${file}" both resolve to "${pattern}"`);
		}
		seen.set(pattern, file);
	};
	const walk = (node: RouteNode, prefix: string) => {
		const pattern = prefix === "" ? "/" : prefix;
		if (node.page !== null) claim(pattern, node.page);
		if (node.endpoint !== null) claim(pattern, node.endpoint);
		for (const extension of node.extensions) {
			claim(extensionPattern(pattern, extension.extension), extension.file);
		}
		for (const child of node.children) walk(child, `${prefix}${segmentKey(child.segment!)}`);
	};
	walk(root, "");
}
