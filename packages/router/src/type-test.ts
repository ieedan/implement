import { Div, signal } from "@implementjs/core";
import { mismatch, Router, type RouteMatcher } from "./index";

const router = Router(
	{
		"/": () => Div(),
		"/about": () => Div(),
		"/issues": {
			layout: (child) => Div({}, child),
			"/": () => Div(),
			"/:id": {
				"/": ({ id }) => Div({ "data-id": id }),
			},
		},
		"/users": {
			"/:id": ({ id }) => Div({ "data-id": id }),
		},
		"/docs": {
			"/": () => Div(),
			"/:...slug": ({ slug }) => Div({ "data-slug": slug }),
		},
	},
	{ fallback: () => Div({}, "Not found") },
);

router.href("/");
router.href("/about");
router.href("/issues");
router.href("/issues/:id", { id: 42 });
router.href("/users/:id", { id: 42 });
// @ts-expect-error params are required for parameterized paths
router.href("/issues/:id");
// @ts-expect-error params are required for parameterized paths
router.href("/users/:id");
// @ts-expect-error not a route
router.href("/nope");
// @ts-expect-error "/users" has no render of its own, only "/users/:id"
router.href("/users");
router.navigate("/", { replace: true });
router.navigate("/about");
router.navigate("/about", { noScroll: true });
router.navigate("/issues/:id", { id: "1" }, { replace: true });
router.navigate("/issues/:id", { id: "1" }, { replace: true, noScroll: true });
router.Link({ to: "/about" }, "About");
router.Link({ to: "/about", noScroll: true }, "About");
router.Link({ to: "/issues/:id", params: { id: "42" } }, "Open");
router.Link({ to: "/users/:id", params: { id: "42" } }, "Open");
// @ts-expect-error params are required for parameterized links
router.Link({ to: "/issues/:id" }, "Open");
router.href("/docs");
router.href("/docs/:...slug", { slug: "guide/install" });
// @ts-expect-error params are required for catch-all paths
router.href("/docs/:...slug");
router.navigate("/docs/:...slug", { slug: "guide" });
router.Link({ to: "/docs/:...slug", params: { slug: "guide/install" } }, "Guide");

// --- the params shape `Link` and `navigate` share ---------------------------

router.navigate("/issues/:id", { params: { id: "1" } });
router.navigate("/issues/:id", { params: { id: 1 }, replace: true });
router.navigate("/docs/:...slug", { params: { slug: "guide" }, noScroll: true });
router.href("/issues/:id", { params: { id: 42 } });
// @ts-expect-error the nested shape still needs the path's params
router.navigate("/issues/:id", { replace: true });
// @ts-expect-error a path without params has none to nest
router.navigate("/about", { params: { id: 1 } });

// a signal is a param wherever a param goes, including programmatic navigation
const id = signal(42);
router.href("/issues/:id", { id });
router.href("/issues/:id", { params: { id } });
router.navigate("/issues/:id", { id });
router.navigate("/issues/:id", { params: { id }, replace: true });

// so the object behind a link carries over to the navigation it becomes
const issueParams = { id };
router.Link({ to: "/issues/:id", params: issueParams }, "Open");
router.navigate("/issues/:id", { params: issueParams });
router.href("/issues/:id", { params: issueParams });

// --- param matchers -------------------------------------------------------

const integer: RouteMatcher<number> = {
	match: (value) => (/^\d+$/.test(value) ? Number(value) : mismatch),
};

declare module "./index" {
	interface ParamTypes {
		integer: number;
	}
}

const matched = Router(
	{
		"/posts": {
			"/:id=integer": ({ id }) => {
				const value: number = id.get();
				return Div({ "data-id": `${value}` });
			},
		},
		"/docs": {
			"/:...slug=integer": ({ slug }) => Div({ "data-slug": `${slug.get()}` }),
		},
	},
	{ matchers: { integer } },
);

matched.href("/posts/:id=integer", { id: 42 });
// a string still builds a URL — the matcher runs on the way back in, not here
matched.href("/posts/:id=integer", { id: "42" });
// @ts-expect-error the param is named `id`, not `id=integer`
matched.href("/posts/:id=integer", { "id=integer": 42 });
// @ts-expect-error params are required for parameterized paths
matched.href("/posts/:id=integer");
matched.navigate("/docs/:...slug=integer", { slug: 3 });
matched.Link({ to: "/posts/:id=integer", params: { id: 42 } }, "Open");
matched.navigate("/posts/:id=integer", { params: { id: signal(42) } });
matched.href("/posts/:id=integer", { params: { id: signal(42) } });
