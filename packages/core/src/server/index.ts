import { reconcileChildren } from "../components";
import type { Child, IMountable } from "../components/types";
import { installDomEnvironment } from "../dom";
import { installServerLocation, normalizePath, type RouterLocation } from "../router/location";
import { mountChild } from "../tree";
import { createServerEnvironment, escapeText, serializeChildren, ServerDocument } from "./dom";

export type ServerLocation = string | { path: string; search?: string; hash?: string };

export type RenderToStringOptions = {
	/** Request URL for the router — a path/URL string or `{ path, search, hash }`. Defaults to `"/"`. */
	location?: ServerLocation;
};

export type RenderToStringResult = {
	/**
	 * Serialized body content. The server body is the render root, so `Portal`
	 * output (which defaults to `document.body`) lands at the end of it.
	 */
	html: string;
	/**
	 * Serialized `Implement.Head` output for the document shell, with a
	 * `<title>` first when one was set via `Implement.Head.Title`.
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
 * Renders `children` to an HTML string (tier-1 SSR: no hydration — the client
 * mounts its own tree from scratch and replaces the server markup).
 *
 * The render is synchronous: signals hold their initial values, `Await`
 * renders its `WhileLoading` branch, and `Lifecycle.onMount` never fires
 * (it is deferred past the render). Event handlers and `Implement.Window` /
 * `Implement.Document` listeners are no-ops. `navigateTo` and
 * `searchParam.set` throw — pass the request URL via `options.location`
 * instead. Everything mounted is unmounted before returning, so signal
 * subscriptions created during the render are torn down.
 */
export function renderToString(
	children: Child | Child[],
	options: RenderToStringOptions = {},
): RenderToStringResult {
	const doc = new ServerDocument();
	const restoreDom = installDomEnvironment(createServerEnvironment(doc));
	const restoreLocation = installServerLocation(toRouterLocation(options.location));
	const mounted: IMountable[] = [];
	try {
		const list = Array.isArray(children) ? children : [children];
		for (const factory of reconcileChildren({}, ...list)) {
			const instance = factory();
			mounted.push(instance);
			mountChild(instance, doc.body as unknown as HTMLElement);
		}
		const html = serializeChildren(doc.body);
		// marked so the client sweeps them once its own Head content mounts
		for (const child of doc.head.childNodes) {
			if ("setAttribute" in child) child.setAttribute("data-ssr", "");
		}
		const title = doc.title === "" ? "" : `<title>${escapeText(doc.title)}</title>`;
		return { html, head: title + serializeChildren(doc.head) };
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
