import { readdirSync } from "node:fs";
import { join } from "node:path";

export const PAGE_FILE = "index.ts";
export const LAYOUT_FILE = "layout.ts";
export const ERROR_FILE = "error.ts";

export type RouteSegment =
	| { kind: "static"; value: string }
	| { kind: "param"; name: string }
	| { kind: "rest"; name: string }
	| { kind: "group"; name: string };

export type RouteNode = {
	/** Directory path relative to the routes dir, `""` for the root. */
	dir: string;
	segment: RouteSegment | null;
	/** Params accumulated from the root down to (and including) this segment. */
	params: string[];
	/** Relative path of this directory's page (`index.ts` or `index@<target>.ts`), when present. */
	page: string | null;
	/**
	 * Layout-reset target of an `index@<target>.ts` page: `""` resets to the
	 * root layout, `"(name)"`/`"segment"` to that ancestor directory's level.
	 * `null` when the page inherits normally.
	 */
	pageResetTo: string | null;
	/** Relative path of this directory's layout (`layout.ts` or `layout@<target>.ts`), when present. */
	layout: string | null;
	/** Layout-reset target of a `layout@<target>.ts` layout; `null` when it inherits normally. */
	layoutResetTo: string | null;
	children: RouteNode[];
};

export type RouteTree = {
	root: RouteNode;
	/** Relative path of the root `error.ts`, when present. */
	error: string | null;
};

/** `[...slug]` → rest, `[id]` → param, `(name)` → group, anything else → static. */
export function parseSegment(name: string): RouteSegment {
	if (name.startsWith("[") || name.endsWith("]")) {
		const match = /^\[(\.\.\.)?([^[\]./]+)\]$/.exec(name);
		if (!match) {
			throw new Error(`Invalid route directory name "${name}" — expected [param] or [...rest]`);
		}
		return match[1] ? { kind: "rest", name: match[2]! } : { kind: "param", name: match[2]! };
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
 * `index.ts`/`layout.ts` → plain page/layout; `index@<target>.ts` /
 * `layout@<target>.ts` → the same with a layout reset (`@` alone targets the
 * root). Anything else is not a routing file.
 */
export function parseRouteFileName(name: string): RouteFileInfo | null {
	if (name === PAGE_FILE) return { kind: "page", resetTo: null };
	if (name === LAYOUT_FILE) return { kind: "layout", resetTo: null };
	const match = /^(index|layout)@(.*)\.ts$/.exec(name);
	if (!match) return null;
	return { kind: match[1] === "index" ? "page" : "layout", resetTo: match[2]! };
}

/** Whether a filename participates in routing (including `@` reset variants and `error.ts`). */
export function isRouteFileName(name: string): boolean {
	return name === ERROR_FILE || parseRouteFileName(name) !== null;
}

/**
 * Scans a routes directory into a tree of pages and layouts. Only `index.ts`,
 * `layout.ts`, their `@` layout-reset variants, and a root `error.ts` are
 * routing files — anything else is colocated code and ignored. Dot-directories
 * are skipped. `(group)` directories scope layouts without contributing a URL
 * segment.
 */
export function scanRoutes(routesDir: string): RouteTree {
	const tree: RouteTree = {
		root: scanDirectory(routesDir, "", null, []),
		error: null,
	};
	if (
		readdirSync(routesDir, { withFileTypes: true }).some(
			(entry) => entry.isFile() && entry.name === ERROR_FILE,
		)
	) {
		tree.error = ERROR_FILE;
	}
	assertUniquePatterns(tree.root);
	return tree;
}

function scanDirectory(
	routesDir: string,
	dir: string,
	segment: RouteSegment | null,
	params: string[],
): RouteNode {
	const node: RouteNode = {
		dir,
		segment,
		params,
		page: null,
		pageResetTo: null,
		layout: null,
		layoutResetTo: null,
		children: [],
	};
	const absolute = dir === "" ? routesDir : join(routesDir, dir);
	const entries = readdirSync(absolute, { withFileTypes: true }).sort((a, b) =>
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
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

		const childSegment = parseSegment(entry.name);
		if (childSegment.kind === "param" || childSegment.kind === "rest") {
			if (params.includes(childSegment.name)) {
				throw new Error(`Duplicate route param "${childSegment.name}" at "${relative}"`);
			}
		}
		const childParams =
			childSegment.kind === "param" || childSegment.kind === "rest"
				? [...params, childSegment.name]
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

function segmentIsRest(segment: RouteSegment | null): segment is { kind: "rest"; name: string } {
	return segment !== null && segment.kind === "rest";
}

/** Whether the subtree contributes any routing (a page or a layout somewhere). */
export function hasRouteFiles(node: RouteNode): boolean {
	return node.page !== null || node.layout !== null || node.children.some(hasRouteFiles);
}

/**
 * The URL-pattern contribution of a segment: `/docs`, `/:id`, or `/:...slug`.
 * `(group)` segments contribute nothing.
 */
export function segmentKey(segment: RouteSegment): string {
	if (segment.kind === "static") return `/${segment.value}`;
	if (segment.kind === "param") return `/:${segment.name}`;
	if (segment.kind === "rest") return `/:...${segment.name}`;
	return "";
}

/** Since `(group)` directories vanish from the URL, distinct pages can collide on one path. */
function assertUniquePatterns(root: RouteNode): void {
	const seen = new Map<string, string>();
	const walk = (node: RouteNode, prefix: string) => {
		if (node.page !== null) {
			const pattern = prefix === "" ? "/" : prefix;
			const existing = seen.get(pattern);
			if (existing !== undefined) {
				throw new Error(`"${existing}" and "${node.page}" both resolve to "${pattern}"`);
			}
			seen.set(pattern, node.page);
		}
		for (const child of node.children) walk(child, `${prefix}${segmentKey(child.segment!)}`);
	};
	walk(root, "");
}
