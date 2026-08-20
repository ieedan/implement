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
const ENDPOINT_FILE = "server.ts";
const PAGE_SERVER_FILE = "index.server.ts";
const LAYOUT_SERVER_FILE = "layout.server.ts";

/** `.md`, `.json` — a dot-directory naming the extension its `server.ts` serves. */
const EXTENSION_DIR = /^(\.[a-z0-9]+)+$/i;

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
	/** Relative path of this directory's `index.server.ts` load, when present. */
	pageServer: string | null;
	/** Relative path of this directory's `layout.server.ts` load, when present. */
	layoutServer: string | null;
	/** Relative path of this directory's `server.ts` endpoint, when present. */
	endpoint: string | null;
	/** Extension endpoints from `.<ext>` child directories holding a `server.ts`. */
	extensions: { extension: string; file: string }[];
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
		pageServer: null,
		layoutServer: null,
		endpoint: null,
		extensions: [],
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
		if (name === ENDPOINT_FILE) {
			node.endpoint = relative;
			continue;
		}
		if (name === PAGE_SERVER_FILE) {
			node.pageServer = relative;
			continue;
		}
		if (name === LAYOUT_SERVER_FILE) {
			node.layoutServer = relative;
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
		if (name.startsWith(".")) {
			// a `.<ext>` directory holding a server.ts serves this directory's
			// path with the extension appended; any other dot-directory is skipped
			const child = source.dirs.get(name)!;
			if (EXTENSION_DIR.test(name) && child.files.includes(ENDPOINT_FILE)) {
				const relative = dir === "" ? name : `${dir}/${name}`;
				node.extensions.push({ extension: name, file: `${relative}/${ENDPOINT_FILE}` });
			}
			continue;
		}
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

	if (node.endpoint !== null && node.page !== null) {
		throw new Error(
			`"${node.endpoint}" conflicts with "${node.page}" — a directory serves a page or an endpoint, not both`,
		);
	}
	if (node.pageServer !== null && node.page === null) {
		throw new Error(
			`"${node.pageServer}" has no "${dir === "" ? "" : `${dir}/`}index.ts" page to load for`,
		);
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
	return (
		node.page !== null ||
		node.layout !== null ||
		node.layoutServer !== null ||
		node.endpoint !== null ||
		node.extensions.length > 0 ||
		node.children.some(hasRouteFiles)
	);
}

/** The URL pattern an extension endpoint serves: its directory's pattern with the extension appended. */
function extensionPattern(pattern: string, extension: string): string {
	return pattern === "/" ? `/${extension}` : `${pattern}${extension}`;
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

/** Route files (relative to `src/routes`) the preview must compile, server files included. */
export function routeFiles(tree: RouteTree): string[] {
	const files: string[] = [];
	if (tree.error !== null) files.push(tree.error);
	const walk = (node: RouteNode) => {
		if (node.page !== null) files.push(node.page);
		if (node.layout !== null) files.push(node.layout);
		if (node.pageServer !== null) files.push(node.pageServer);
		if (node.layoutServer !== null) files.push(node.layoutServer);
		if (node.endpoint !== null) files.push(node.endpoint);
		for (const extension of node.extensions) files.push(extension.file);
		for (const child of node.children) walk(child);
	};
	walk(tree.root);
	return files;
}

export type DataChain = { layoutFiles: string[]; pageFiles: string[] };

/**
 * The server-load files feeding each directory's layout and page `data`,
 * resets applied — the browser port of kit's `dataChains`.
 */
export function dataChains(tree: RouteTree): Map<RouteNode, DataChain> {
	const parents = new Map<RouteNode, RouteNode | null>();
	const linkParents = (node: RouteNode, parent: RouteNode | null) => {
		parents.set(node, parent);
		for (const child of node.children) linkParents(child, node);
	};
	linkParents(tree.root, null);

	const rawChain = (node: RouteNode): RouteNode[] => {
		const chain: RouteNode[] = [];
		for (let cursor: RouteNode | null = node; cursor !== null; cursor = parents.get(cursor)!) {
			chain.unshift(cursor);
		}
		return chain;
	};

	const effective = new Map<RouteNode, RouteNode[]>();
	const effectiveChain = (node: RouteNode): RouteNode[] => {
		const cached = effective.get(node);
		if (cached !== undefined) return cached;
		const parent = parents.get(node) ?? null;
		let chain: RouteNode[];
		if (parent === null) {
			chain = [node];
		} else if (node.layoutResetTo === null) {
			chain = [...effectiveChain(parent), node];
		} else if (node.layoutResetTo === "") {
			chain = [tree.root, node];
		} else {
			const raw = rawChain(node);
			let target: RouteNode | null = null;
			for (let i = raw.length - 2; i >= 1; i--) {
				if (rawName(raw[i]!) === node.layoutResetTo) {
					target = raw[i]!;
					break;
				}
			}
			if (target === null) {
				throw new Error(`No ancestor segment "${node.layoutResetTo}" to reset to`);
			}
			chain = [...effectiveChain(target), node];
		}
		effective.set(node, chain);
		return chain;
	};

	const pageChain = (node: RouteNode): RouteNode[] => {
		if (node.pageResetTo === null) return effectiveChain(node);
		if (node.pageResetTo === "") return [tree.root];
		const raw = rawChain(node);
		for (let i = raw.length - 1; i >= 1; i--) {
			if (rawName(raw[i]!) === node.pageResetTo) return effectiveChain(raw[i]!);
		}
		throw new Error(`No ancestor segment "${node.pageResetTo}" to reset to`);
	};

	const serverFiles = (chain: RouteNode[]): string[] =>
		chain.flatMap((entry) => (entry.layoutServer === null ? [] : [entry.layoutServer]));

	const chains = new Map<RouteNode, DataChain>();
	const walk = (node: RouteNode) => {
		chains.set(node, {
			layoutFiles: serverFiles(effectiveChain(node)),
			pageFiles: [
				...serverFiles(pageChain(node)),
				...(node.pageServer === null ? [] : [node.pageServer]),
			],
		});
		for (const child of node.children) walk(child);
	};
	walk(tree.root);
	return chains;
}

/** Every load-bearing page route: its URL pattern and load chain, root first. */
export function loadRouteFiles(tree: RouteTree): { pattern: string; files: string[] }[] {
	const chains = dataChains(tree);
	const routes: { pattern: string; files: string[] }[] = [];
	const walk = (node: RouteNode, prefix: string) => {
		if (node.page !== null) {
			const files = chains.get(node)!.pageFiles;
			if (files.length > 0) routes.push({ pattern: prefix === "" ? "/" : prefix, files });
		}
		for (const child of node.children) walk(child, `${prefix}${segmentKey(child.segment!)}`);
	};
	walk(tree.root, "");
	return routes;
}

/** Every `server.ts` endpoint: its base pattern, extension, and file. */
export function endpointFiles(
	tree: RouteTree,
): { pattern: string; extension: string | null; file: string }[] {
	const routes: { pattern: string; extension: string | null; file: string }[] = [];
	const walk = (node: RouteNode, prefix: string) => {
		const pattern = prefix === "" ? "/" : prefix;
		if (node.endpoint !== null) routes.push({ pattern, extension: null, file: node.endpoint });
		for (const extension of node.extensions) {
			routes.push({ pattern, extension: extension.extension, file: extension.file });
		}
		for (const child of node.children) walk(child, `${prefix}${segmentKey(child.segment!)}`);
	};
	walk(tree.root, "");
	return routes;
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
	dataFor: (files: string[]) => unknown = () => undefined,
): Record<string, unknown> {
	const chains = dataChains(tree);
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

	const pageRender = (node: RouteNode) => {
		const PageComponent = moduleFor(node.page!);
		const data = dataFor(chains.get(node)!.pageFiles);
		return (params: unknown) => PageComponent({ params, url, data });
	};

	const nodeRoutes = (node: RouteNode): Record<string, unknown> => {
		const entries: Record<string, unknown> = {};
		if (node.layout !== null) {
			const LayoutComponent = moduleFor(node.layout);
			const data = dataFor(chains.get(node)!.layoutFiles);
			entries.layout = (children: Mountable, params: unknown) =>
				LayoutComponent({ children, params, url, data });
		}
		if (node.page !== null && !hoistedPages.has(node)) {
			entries["/"] = pageRender(node);
		}
		for (const child of node.children) {
			if (detached.has(child)) continue;
			entries[routerKey(child.segment!)] = nodeRoutes(child);
		}
		for (const hoist of hoists.get(node) ?? []) {
			if (hoist.kind === "page") {
				entries[hoist.key] = pageRender(hoist.source);
			} else {
				entries[hoist.key] = nodeRoutes(hoist.source);
			}
		}
		return entries;
	};

	return nodeRoutes(tree.root);
}
