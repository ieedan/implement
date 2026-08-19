import type { Child, Mountable } from "@implementjs/core";
import { DocsLayout, type DocsCollection } from "../components/docs/layout";
import { DocsPage } from "../views/docs-page";
import { pages, primitivePages, type Page } from "./content";

/** Nested docs route table the router expects, built from a Velite collection. */
export type DocsRoutes = {
	layout: (child: Mountable) => Child;
	"/": () => Child;
};

type Branch = {
	layout?: (child: Mountable) => Child;
	page?: Page;
	children: Map<string, Branch>;
};

/** `/docs` routes for the framework docs. */
export function docsRoutes(): DocsRoutes {
	return collectionRoutes({ pages, label: "Docs" });
}

/** `/primitives/docs` routes for the primitives docs. */
export function primitivesDocsRoutes(): DocsRoutes {
	return collectionRoutes({ pages: primitivePages, label: "Primitives" });
}

function collectionRoutes(collection: DocsCollection): DocsRoutes {
	const root: Branch = {
		children: new Map(),
		layout: (child) => DocsLayout(child, collection),
	};

	for (const page of collection.pages) {
		insertPage(root, page);
	}

	const routes = toRouteNode(root, collection.pages);
	if (!isDocsRoutes(routes)) {
		throw new Error(`An index.md is required for the ${collection.label} docs route`);
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

function toRouteNode(node: Branch, collection: Page[]): Record<string, unknown> {
	const routes: Record<string, unknown> = {};
	if (node.layout) routes.layout = node.layout;
	if (node.page) {
		const page = node.page;
		routes["/"] = () => DocsPage(page, collection);
	}
	for (const [segment, child] of node.children) {
		routes[`/${segment}`] = toRouteNode(child, collection);
	}
	return routes;
}
