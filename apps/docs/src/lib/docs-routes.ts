import type { Child, Mountable } from "@packages/implement";
import { DocsLayout } from "../components/docs/layout";
import { DocsPage } from "../views/docs-page";
import { pages, type Page } from "./content";

/** Nested `/docs` table the router expects. Built from the Velite `pages` collection. */
export type DocsRoutes = {
	layout: (child: Mountable) => Child;
	"/": () => Child;
};

type Branch = {
	layout?: (child: Mountable) => Child;
	page?: Page;
	children: Map<string, Branch>;
};

export function docsRoutes(): DocsRoutes {
	const root: Branch = { children: new Map(), layout: (child) => DocsLayout(child) };

	for (const page of pages) {
		insertPage(root, page);
	}

	const routes = toRouteNode(root);
	if (!isDocsRoutes(routes)) {
		throw new Error("src/content/index.md is required for the /docs route");
	}

	return routes;
}

function isDocsRoutes(routes: Record<string, unknown>): routes is DocsRoutes {
	return typeof routes.layout === "function" && typeof routes["/"] === "function";
}

function insertPage(root: Branch, page: Page): void {
	const segments = page.slug.split("/").filter(Boolean);
	let node = root;
	for (const segment of segments) {
		let child = node.children.get(segment);
		if (child == null) {
			child = { children: new Map() };
			node.children.set(segment, child);
		}
		node = child;
	}
	if (node.page != null) {
		throw new Error(`Duplicate docs page for "${page.permalink}"`);
	}
	node.page = page;
}

function toRouteNode(node: Branch): Record<string, unknown> {
	const routes: Record<string, unknown> = {};
	if (node.layout) routes.layout = node.layout;
	if (node.page) {
		const page = node.page;
		routes["/"] = () => DocsPage(page);
	}
	for (const [segment, child] of node.children) {
		routes[`/${segment}`] = toRouteNode(child);
	}
	return routes;
}
