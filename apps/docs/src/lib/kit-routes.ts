import type { Child, Mountable, Readable, RouterLocation } from "@implementjs/core";

/**
 * Browser port of `@implementjs/kit`'s route scanner and router codegen,
 * operating on a virtual file list instead of the filesystem so the tutorial
 * playground can run kit apps in the preview. Kept behaviorally in sync with
 * `packages/kit/src/scan.ts` and `packages/kit/src/codegen.ts`.
 */

export const ROUTES_DIR = "src/routes";

const PAGE_FILE = "index.ts";
const LAYOUT_FILE = "layout.ts";
const ERROR_FILE = "error.ts";

/**
 * Pathless key segment marking a hoisted `index@` page, so it never collides
 * with the key of a directory emitted at the same level. The core router drops
 * `(…)` segments when matching.
 */
const RESET_MARKER = "(@reset)";

type RouteSegment =
	| { kind: "static"; value: string }
	| { kind: "param"; name: string }
	| { kind: "rest"; name: string }
	| { kind: "group"; name: string };

type RouteNode = {
	/** Directory path relative to the routes dir, `""` for the root. */
	dir: string;
	segment: RouteSegment | null;
	params: string[];
	/** Relative path of this directory's page, when present. */
	page: string | null;
	pageResetTo: string | null;
	layout: string | null;
	layoutResetTo: string | null;
	children: RouteNode[];
};

export type RouteTree = {
	root: RouteNode;
	/** Relative path of the root `error.ts`, when present. */
	error: string | null;
};

/** `[...slug]` → rest, `[id]` → param, `(name)` → group, anything else → static. */
function parseSegment(name: string): RouteSegment {
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

function parseRouteFileName(name: string): RouteFileInfo | null {
	if (name === PAGE_FILE) return { kind: "page", resetTo: null };
	if (name === LAYOUT_FILE) return { kind: "layout", resetTo: null };
	const match = /^(index|layout)@(.*)\.ts$/.exec(name);
	if (!match) return null;
	return { kind: match[1] === "index" ? "page" : "layout", resetTo: match[2]! };
}

/** Virtual directory built from the lesson's file paths. */
type Dir = { files: string[]; dirs: Map<string, Dir> };

function buildDirTree(paths: string[]): Dir {
	const root: Dir = { files: [], dirs: new Map() };
	for (const path of paths) {
		const segments = path.split("/");
		let dir = root;
		for (const segment of segments.slice(0, -1)) {
			let child = dir.dirs.get(segment);
			if (child == null) {
				child = { files: [], dirs: new Map() };
				dir.dirs.set(segment, child);
			}
			dir = child;
		}
		dir.files.push(segments[segments.length - 1]!);
	}
	return root;
}

/**
 * Scans the lesson's `src/routes/**` file paths into a route tree, mirroring
 * kit's filesystem scan — including its validation errors, so the preview
 * reports the same mistakes the real dev server would.
 */
export function scanVirtualRoutes(files: readonly string[]): RouteTree {
	const prefix = `${ROUTES_DIR}/`;
	const paths = files
		.filter((path) => path.startsWith(prefix))
		.map((path) => path.slice(prefix.length));
	const tree: RouteTree = {
		root: scanDirectory(buildDirTree(paths), "", null, []),
		error: null,
	};
	if (paths.includes(ERROR_FILE)) tree.error = ERROR_FILE;
	assertUniquePatterns(tree.root);
	return tree;
}

function scanDirectory(
	source: Dir,
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

	for (const name of [...source.files].sort((a, b) => a.localeCompare(b))) {
		const relative = dir === "" ? name : `${dir}/${name}`;
		if (name === ERROR_FILE) {
			if (dir !== "") {
				throw new Error(`"${relative}" — error.ts is only supported at the routes root`);
			}
			continue;
		}
		const info = parseRouteFileName(name);
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
	}

	for (const name of [...source.dirs.keys()].sort((a, b) => a.localeCompare(b))) {
		if (name.startsWith(".")) continue;
		const relative = dir === "" ? name : `${dir}/${name}`;
		const childSegment = parseSegment(name);
		if (childSegment.kind === "param" || childSegment.kind === "rest") {
			if (params.includes(childSegment.name)) {
				throw new Error(`Duplicate route param "${childSegment.name}" at "${relative}"`);
			}
		}
		const childParams =
			childSegment.kind === "param" || childSegment.kind === "rest"
				? [...params, childSegment.name]
				: params;
		const child = scanDirectory(source.dirs.get(name)!, relative, childSegment, childParams);
		if (!hasRouteFiles(child)) continue;
		// a rest segment swallows the rest of the path — nothing can route below it
		if (segment !== null && segment.kind === "rest") {
			throw new Error(
				`"${relative}" — a [...${segment.name}] directory cannot contain nested routes`,
			);
		}
		node.children.push(child);
	}

	return node;
}

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

function hasRouteFiles(node: RouteNode): boolean {
	return node.page !== null || node.layout !== null || node.children.some(hasRouteFiles);
}

/** URL-pattern contribution of a segment; `(group)` segments contribute nothing. */
function segmentKey(segment: RouteSegment): string {
	if (segment.kind === "static") return `/${segment.value}`;
	if (segment.kind === "param") return `/:${segment.name}`;
	if (segment.kind === "rest") return `/:...${segment.name}`;
	return "";
}

/**
 * The router-tree key for a segment. `(group)` segments keep a `/(name)` part —
 * the core router ignores it for matching, while it keeps sibling keys unique
 * and scopes the group's layout.
 */
function routerKey(segment: RouteSegment): string {
	if (segment.kind === "group") return `/(${segment.name})`;
	return segmentKey(segment);
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

/** Number of pages in the tree — the preview shows its URL bar past one. */
export function pageCount(tree: RouteTree): number {
	let count = 0;
	const walk = (node: RouteNode) => {
		if (node.page !== null) count++;
		for (const child of node.children) walk(child);
	};
	walk(tree.root);
	return count;
}

/** Route files (relative to `src/routes`) the preview must compile. */
export function routeFiles(tree: RouteTree): string[] {
	const files: string[] = [];
	if (tree.error !== null) files.push(tree.error);
	const walk = (node: RouteNode) => {
		if (node.page !== null) files.push(node.page);
		if (node.layout !== null) files.push(node.layout);
		for (const child of node.children) walk(child);
	};
	walk(tree.root);
	return files;
}

export type RouteComponent = (props: Record<string, unknown>) => Child;

const rawName = (node: RouteNode): string => node.dir.split("/").pop()!;

/**
 * Builds the `Router(...)` routes object for the scanned tree — the direct
 * equivalent of kit's generated `$implement/router` module. Pages render as
 * `Page({ params, url })`, layouts as `Layout({ children, params, url })`, and
 * `@` layout resets hoist pages/subtrees to their target ancestor.
 */
export function buildRouterRoutes(
	tree: RouteTree,
	moduleFor: (file: string) => RouteComponent,
	url: Readable<RouterLocation>,
): Record<string, unknown> {
	type Hoist = { key: string; source: RouteNode; kind: "page" | "subtree" };
	const hoists = new Map<RouteNode, Hoist[]>();
	/** Pages emitted at their reset target instead of in their own node. */
	const hoistedPages = new Set<RouteNode>();
	/** Nodes emitted at their layout's reset target instead of under their parent. */
	const detached = new Set<RouteNode>();

	// `chain` is root..current; the scan already validated that the target exists
	const targetIndex = (chain: RouteNode[], resetTo: string, includeSelf: boolean): number => {
		if (resetTo === "") return 0;
		for (let i = chain.length - (includeSelf ? 1 : 2); i >= 1; i--) {
			if (rawName(chain[i]!) === resetTo) return i;
		}
		throw new Error(`No ancestor segment "${resetTo}" to reset to`);
	};

	const keyFrom = (chain: RouteNode[], index: number): string =>
		chain
			.slice(index + 1)
			.map((ancestor) => routerKey(ancestor.segment!))
			.join("");

	const plan = (node: RouteNode, chain: RouteNode[]) => {
		if (node.page !== null && node.pageResetTo !== null) {
			const index = targetIndex(chain, node.pageResetTo, true);
			const target = chain[index]!;
			const key = `${keyFrom(chain, index)}/${RESET_MARKER}`;
			hoists.set(target, [...(hoists.get(target) ?? []), { key, source: node, kind: "page" }]);
			hoistedPages.add(node);
		}
		if (node.layoutResetTo !== null) {
			const index = targetIndex(chain, node.layoutResetTo, false);
			const target = chain[index]!;
			const key = keyFrom(chain, index);
			hoists.set(target, [...(hoists.get(target) ?? []), { key, source: node, kind: "subtree" }]);
			detached.add(node);
		}
		for (const child of node.children) plan(child, [...chain, child]);
	};
	plan(tree.root, [tree.root]);

	const pageRender = (file: string) => {
		const PageComponent = moduleFor(file);
		return (params: unknown) => PageComponent({ params, url });
	};

	const nodeRoutes = (node: RouteNode): Record<string, unknown> => {
		const entries: Record<string, unknown> = {};
		if (node.layout !== null) {
			const LayoutComponent = moduleFor(node.layout);
			entries.layout = (children: Mountable, params: unknown) =>
				LayoutComponent({ children, params, url });
		}
		if (node.page !== null && !hoistedPages.has(node)) {
			entries["/"] = pageRender(node.page);
		}
		for (const child of node.children) {
			if (detached.has(child)) continue;
			entries[routerKey(child.segment!)] = nodeRoutes(child);
		}
		for (const hoist of hoists.get(node) ?? []) {
			if (hoist.kind === "page") {
				entries[hoist.key] = pageRender(hoist.source.page!);
			} else {
				entries[hoist.key] = nodeRoutes(hoist.source);
			}
		}
		return entries;
	};

	return nodeRoutes(tree.root);
}
