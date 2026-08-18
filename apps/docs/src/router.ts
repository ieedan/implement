import { Router } from "@packages/implement";
import { docsRoutes } from "./lib/docs-routes";
import { tutorialRoutes } from "./lib/tutorial-routes";
import { Home } from "./views/home";
import { NotFound } from "./views/not-found";

export const router = Router(
	{
		"/": () => Home(),
		"/docs": docsRoutes(),
		"/tutorial": tutorialRoutes(),
	},
	{ fallback: () => NotFound() },
);

export const Link = router.Link.bind(router);
