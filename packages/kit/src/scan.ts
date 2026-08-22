import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
};

export type RouteTree = {
	root: RouteNode;
	/** Relative path of the root `error.ts`, when present. */
	error: string | null;
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
 * and a root `error.ts` are routing files — anything else is colocated code
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
	const tree: RouteTree = {
		root: scanDirectory(routesDir, "", null, []),
		error: null,
		matchers,
	};
	if (
		readdirSync(routesDir, { withFileTypes: true }).some(
			(entry) => entry.isFile() && entry.name === ERROR_FILE,
		)
	) {
		tree.error = ERROR_FILE;
	}
	assertUniquePatterns(tree.root);
	assertMatchersExist(tree.root, matchers);
	return tree;
}

function scanDirectory(
	routesDir: string,
	dir: string,
	segment: RouteSegment | null,
	params: RouteParam[],
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
				if (dir !== "") {
					throw new Error(`"${relative}" — error.ts is only supported at the routes root`);
				}
				continue;
			}
			if (entry.name === ENDPOINT_FILE) {
				node.endpoint = relative;
				continue;
			}
			if (entry.name === PAGE_SERVER_FILE) {
				node.pageServer = relative;
				continue;
			}
			if (entry.name === LAYOUT_SERVER_FILE) {
				node.layoutServer = relative;
				continue;
			}
			const info = parseRouteFileName(entry.name);
			if (info === null) continue;
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
				node.extensions.push({ extension: entry.name, file: `${relative}/${ENDPOINT_FILE}` });
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
		const child = scanDirectory(routesDir, relative, childSegment, childParams);
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

/** Whether the subtree contributes any routing (a page, layout, load, or endpoint somewhere). */
export function hasRouteFiles(node: RouteNode): boolean {
	return (
		node.page !== null ||
		node.layout !== null ||
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
	const known = new Set(matchers);
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
					? "the app declares no param matchers"
					: `the ones it declares are ${matchers.join(", ")}`;
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
