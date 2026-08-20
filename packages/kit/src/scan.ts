import { readdirSync } from "node:fs";
import { join } from "node:path";

export const PAGE_FILE = "index.ts";
export const LAYOUT_FILE = "layout.ts";
export const ERROR_FILE = "error.ts";

export type RouteSegment =
	| { kind: "static"; value: string }
	| { kind: "param"; name: string }
	| { kind: "rest"; name: string };

export type RouteNode = {
	/** Directory path relative to the routes dir, `""` for the root. */
	dir: string;
	segment: RouteSegment | null;
	/** Params accumulated from the root down to (and including) this segment. */
	params: string[];
	/** Relative path of this directory's `index.ts`, when present. */
	page: string | null;
	/** Relative path of this directory's `layout.ts`, when present. */
	layout: string | null;
	children: RouteNode[];
};

export type RouteTree = {
	root: RouteNode;
	/** Relative path of the root `error.ts`, when present. */
	error: string | null;
};

/** `[...slug]` → rest, `[id]` → param, anything else → static. */
export function parseSegment(name: string): RouteSegment {
	if (name.startsWith("[") || name.endsWith("]")) {
		const match = /^\[(\.\.\.)?([^[\]./]+)\]$/.exec(name);
		if (!match) {
			throw new Error(`Invalid route directory name "${name}" — expected [param] or [...rest]`);
		}
		return match[1] ? { kind: "rest", name: match[2]! } : { kind: "param", name: match[2]! };
	}
	if (name.includes(":")) {
		throw new Error(`Invalid route directory name "${name}" — ":" is reserved`);
	}
	return { kind: "static", value: name };
}

/**
 * Scans a routes directory into a tree of pages and layouts. Only `index.ts`,
 * `layout.ts`, and a root `error.ts` are routing files — anything else is
 * colocated code and ignored. Dot-directories are skipped.
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
	return tree;
}

function scanDirectory(
	routesDir: string,
	dir: string,
	segment: RouteSegment | null,
	params: string[],
): RouteNode {
	const node: RouteNode = { dir, segment, params, page: null, layout: null, children: [] };
	const absolute = dir === "" ? routesDir : join(routesDir, dir);
	const entries = readdirSync(absolute, { withFileTypes: true }).sort((a, b) =>
		a.name.localeCompare(b.name),
	);

	for (const entry of entries) {
		const relative = dir === "" ? entry.name : `${dir}/${entry.name}`;
		if (entry.isFile()) {
			if (entry.name === PAGE_FILE) node.page = relative;
			if (entry.name === LAYOUT_FILE) node.layout = relative;
			if (entry.name === ERROR_FILE && dir !== "") {
				throw new Error(`"${relative}" — error.ts is only supported at the routes root`);
			}
			continue;
		}
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

		const childSegment = parseSegment(entry.name);
		if (childSegment.kind !== "static") {
			if (params.includes(childSegment.name)) {
				throw new Error(`Duplicate route param "${childSegment.name}" at "${relative}"`);
			}
		}
		const childParams = childSegment.kind === "static" ? params : [...params, childSegment.name];
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

function segmentIsRest(segment: RouteSegment | null): segment is { kind: "rest"; name: string } {
	return segment !== null && segment.kind === "rest";
}

/** Whether the subtree contributes any routing (a page or a layout somewhere). */
export function hasRouteFiles(node: RouteNode): boolean {
	return node.page !== null || node.layout !== null || node.children.some(hasRouteFiles);
}

/** The router key for a segment: `docs`, `:id`, or `:...slug`. */
export function segmentKey(segment: RouteSegment): string {
	if (segment.kind === "static") return `/${segment.value}`;
	if (segment.kind === "param") return `/:${segment.name}`;
	return `/:...${segment.name}`;
}
