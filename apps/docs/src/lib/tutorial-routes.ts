import { Implement, navigateTo, P, type Child, type Mountable } from "@implementjs/core";
import { TutorialsLayout } from "../components/tutorials/layout";
import { TutorialPage } from "../views/tutorial-page";
import { tutorials, type Tutorial } from "./content";

export type TutorialRoutes = {
	layout: (child: Mountable) => Child;
	"/": () => Child;
};

type Branch = {
	layout?: (child: Mountable) => Child;
	page?: Tutorial;
	children: Map<string, Branch>;
};

export function tutorialRoutes(): TutorialRoutes {
	const root: Branch = {
		children: new Map(),
		layout: (child) => TutorialsLayout(child),
	};

	for (const lesson of tutorials) {
		insertLesson(root, lesson);
	}

	const routes = toRouteNode(root);
	routes["/"] = () => TutorialIndex();

	if (!isTutorialRoutes(routes)) {
		throw new Error("At least one lesson is required for the /tutorial route");
	}

	return routes;
}

function TutorialIndex(): Mountable {
	const first = tutorials[0];
	if (first == null) {
		return P({ class: "p-6 text-sm text-foreground/60" }, "No lessons yet.");
	}

	return Implement.Lifecycle(
		{
			onMount: () => {
				navigateTo(first.permalink, { replace: true });
			},
		},
		TutorialPage(first),
	);
}

function isTutorialRoutes(routes: Record<string, unknown>): routes is TutorialRoutes {
	return typeof routes.layout === "function" && typeof routes["/"] === "function";
}

function insertLesson(root: Branch, lesson: Tutorial): void {
	const segments = lesson.slug.split("/").filter(Boolean);
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
		throw new Error(`Duplicate tutorial for "${lesson.permalink}"`);
	}
	node.page = lesson;
}

function toRouteNode(node: Branch): Record<string, unknown> {
	const routes: Record<string, unknown> = {};
	if (node.layout) routes.layout = node.layout;
	if (node.page) {
		const lesson = node.page;
		routes["/"] = () => TutorialPage(lesson);
	}
	for (const [segment, child] of node.children) {
		routes[`/${segment}`] = toRouteNode(child);
	}
	return routes;
}
