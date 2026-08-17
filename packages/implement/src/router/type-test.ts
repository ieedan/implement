import { Div } from "../components/elements";
import { Router } from "./index";

const router = Router(
	{
		"/": () => Div(),
		"/issues": {
			layout: (child) => Div({}, child),
			"/": () => Div(),
			"/:id": {
				"/": ({ id }) => Div({ "data-id": id }),
			},
		},
	},
	{ fallback: () => Div({}, "Not found") },
);

router.href("/");
router.href("/issues");
router.href("/issues/:id", { id: 42 });
// @ts-expect-error params are required for parameterized paths
router.href("/issues/:id");
// @ts-expect-error not a route
router.href("/nope");
router.navigate("/", { replace: true });
router.navigate("/issues/:id", { id: "1" }, { replace: true });
router.Link({ to: "/issues/:id", params: { id: "42" } }, "Open");
// @ts-expect-error params are required for parameterized links
router.Link({ to: "/issues/:id" }, "Open");
