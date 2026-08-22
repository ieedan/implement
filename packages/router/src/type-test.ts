import { Div } from "@implementjs/core";
import { Router } from "./index";

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
