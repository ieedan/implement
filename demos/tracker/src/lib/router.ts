import { Signal } from "@packages/ui";

// The framework has no router, so the app hand-rolls a hash-based one.
export type Route = { name: "list" } | { name: "issue"; id: string };

function parse(hash: string): Route {
	const path = hash.replace(/^#\/?/, "");
	const issueMatch = path.match(/^issue\/(.+)$/);
	if (issueMatch) return { name: "issue", id: issueMatch[1]! };
	return { name: "list" };
}

function build(route: Route): string {
	if (route.name === "issue") return `#/issue/${route.id}`;
	return "#/";
}

export const route = new Signal<Route>(parse(location.hash));

window.addEventListener("hashchange", () => {
	route.set(parse(location.hash));
});

export function navigate(next: Route) {
	location.hash = build(next);
}
