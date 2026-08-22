import { reconcileChildren } from "../components";
import type { Child, IMountable } from "../components/types";
import { installDomEnvironment } from "../dom";
import { installServerLocation, normalizePath, type RouterLocation } from "../location";
import { mountChild } from "../tree";
import {
	createServerEnvironment,
	escapeText,
	serializeChildren,
	serializeNodes,
	ServerComment,
	ServerDocument,
	ServerElement,
	ServerRaw,
	ServerText,
	type ServerChildNode,
} from "./dom";

export type ServerLocation = string | { path: string; search?: string; hash?: string };

export type RenderToStringOptions = {
	/** Request URL for the router — a path/URL string or `{ path, search, hash }`. Defaults to `"/"`. */
	location?: ServerLocation;
};

export type RenderToStringResult = {
	/**
	 * Serialized body content: the app tree first, then any `Portal` output
	 * (which defaults to `document.body`, the app tree's parent here just as it
	 * is in the browser) after it.
	 */
	html: string;
	/**
	 * Serialized `ImplementHead` output for the document shell, with a
	 * `<title>` first when one was set via `ImplementHead.Title`.
	 */
	head: string;
};

function toRouterLocation(input: ServerLocation | undefined): RouterLocation {
	if (input === undefined) return { path: "/", search: "", hash: "" };
	if (typeof input === "string") {
		const url = new URL(input, "http://ssr.local");
		return { path: normalizePath(url.pathname), search: url.search, hash: url.hash };
	}
	const search = input.search ?? "";
	const hash = input.hash ?? "";
	return {
		path: normalizePath(input.path),
		search: search === "" || search.startsWith("?") ? search : `?${search}`,
		hash: hash === "" || hash.startsWith("#") ? hash : `#${hash}`,
	};
}

/**
 * Mounts `children` into a fresh server document, hands it to `project`, and
 * tears the render down again. Both render entry points are the same mount —
 * they differ only in what they read off the document before it goes away, so
 * `project` runs while the tree is still standing.
 */
function render<T>(
	children: Child | Child[],
	options: RenderToStringOptions,
	project: (doc: ServerDocument, root: ServerElement) => T,
): T {
	const doc = new ServerDocument();
	// The app mounts into a wrapper inside the body, mirroring the `[data-ssr]`
	// wrapper the client mounts into. Mounting into the body itself would let
	// `Portal` output (which targets the body) land in the middle of the app
	// tree, where hydration's claim cursor runs into it and fails the pass.
	const root = new ServerElement("div");
	doc.body.appendChild(root);
	const restoreDom = installDomEnvironment(createServerEnvironment(doc));
	const restoreLocation = installServerLocation(toRouterLocation(options.location));
	const mounted: IMountable[] = [];
	try {
		const list = Array.isArray(children) ? children : [children];
		for (const factory of reconcileChildren({}, ...list)) {
			const instance = factory();
			mounted.push(instance);
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The wrapper inside the server body is the SSR mount root.
			mountChild(instance, root as unknown as HTMLElement);
		}
		return project(doc, root);
	} finally {
		for (const instance of mounted) {
			try {
				instance.unmount();
			} catch {
				// best-effort teardown: the tree may have failed mid-mount
			}
		}
		restoreLocation();
		restoreDom();
	}
}

/**
 * The rendered body content in document order: the app tree, then whatever
 * `Portal` mounted straight into the body after it. Hydration walks the app
 * tree in order and sweeps whatever it never claims, so portal output has to
 * sit past the end of that walk rather than inside it.
 */
function bodyNodes(doc: ServerDocument, root: ServerElement): ServerChildNode[] {
	return [...root.childNodes, ...doc.body.childNodes.filter((node) => node !== root)];
}

/**
 * Renders `children` to an HTML string (tier-1 SSR: no hydration — the client
 * mounts its own tree from scratch and replaces the server markup).
 *
 * The render is synchronous: signals hold their initial values, `Await`
 * renders its `WhileLoading` branch, and `Lifecycle.onMount` never fires
 * (it is deferred past the render). Event handlers and `ImplementWindow` /
 * `ImplementDocument` listeners are no-ops. `navigateTo` and
 * `searchParam.set` throw — pass the request URL via `options.location`
 * instead. Everything mounted is unmounted before returning, so signal
 * subscriptions created during the render are torn down.
 */
export function renderToString(
	children: Child | Child[],
	options: RenderToStringOptions = {},
): RenderToStringResult {
	return render(children, options, (doc, root) => {
		const html = serializeNodes(bodyNodes(doc, root));
		// marked so the client sweeps them once its own Head content mounts
		for (const child of doc.head.childNodes) {
			if ("setAttribute" in child) child.setAttribute("data-ssr", "");
		}
		const title = doc.title === "" ? "" : `<title>${escapeText(doc.title)}</title>`;
		return { html, head: title + serializeChildren(doc.head) };
	});
}

/** A node of a {@link renderToTree} render. Comments are dropped — nothing but html has a use for them. */
export type RenderedNode =
	| { kind: "text"; text: string }
	| {
			kind: "element";
			tag: string;
			/** Attributes as they were set, `style` excluded — it is {@link RenderedElement.style}. */
			attributes: Record<string, string>;
			/** Style declarations keyed the way a style prop writes them (`fontSize`, `--brand`). */
			style: Record<string, string>;
			children: RenderedNode[];
	  }
	/**
	 * Markup inserted verbatim by `Implement.Html` or the inner content of an
	 * `Svg`, which the render never parsed into nodes. A consumer that needs a
	 * tree here has to parse it — core has no html parser and does not want one.
	 */
	| { kind: "raw"; html: string };

export type RenderedElement = Extract<RenderedNode, { kind: "element" }>;

export type RenderToTreeResult = {
	/** The rendered body content, the same tree {@link renderToString} would have serialized. */
	children: RenderedNode[];
	/** `ImplementHead` output, unmarked — nothing here is hydrated. */
	head: RenderedNode[];
	/** The title set via `ImplementHead.Title`, or `""`. */
	title: string;
};

function toRenderedNode(node: ServerChildNode): RenderedNode | null {
	if (node instanceof ServerText) return { kind: "text", text: node.data };
	if (node instanceof ServerRaw) return { kind: "raw", html: node.html };
	if (node instanceof ServerComment) return null;
	return {
		kind: "element",
		tag: node.localName,
		attributes: Object.fromEntries(node.attributes),
		style: node.styleObject(),
		children: toRenderedNodes(node.childNodes),
	};
}

function toRenderedNodes(children: readonly ServerChildNode[]): RenderedNode[] {
	const nodes: RenderedNode[] = [];
	for (const child of children) {
		const node = toRenderedNode(child);
		if (node !== null) nodes.push(node);
	}
	return nodes;
}

/**
 * The same render as {@link renderToString}, stopping one step earlier: a
 * plain tree of elements, text, and unparsed raw markup instead of html.
 *
 * What renders to something that is not a document wants this — an image
 * rasterizer, a pdf, a terminal — since re-parsing html to get the tree back
 * is a parser nobody needed. Everything the string render's contract says
 * holds here too: one synchronous pass, initial signal values, and the tree
 * is a snapshot, already unmounted by the time it is returned.
 */
export function renderToTree(
	children: Child | Child[],
	options: RenderToStringOptions = {},
): RenderToTreeResult {
	return render(children, options, (doc, root) => ({
		children: toRenderedNodes(bodyNodes(doc, root)),
		head: toRenderedNodes(doc.head.childNodes),
		title: doc.title,
	}));
}
