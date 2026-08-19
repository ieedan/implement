import { Router } from "@implementjs/core";
import { docsRoutes, primitivesDocsRoutes } from "./lib/docs-routes";
import { tutorialRoutes } from "./lib/tutorial-routes";
import { Home } from "./views/home";
import { NotFound } from "./views/not-found";
import { PrimitivesHome } from "./views/primitives-home";
import { ReplPage } from "./views/repl-page";

export const router = Router(
	{
		"/": () => Home(),
		"/docs": docsRoutes(),
		"/primitives": {
			"/": () => PrimitivesHome(),
			"/docs": primitivesDocsRoutes(),
		},
		"/tutorial": tutorialRoutes(),
		"/repl": () => ReplPage(),
	},
	{ fallback: () => NotFound() },
);

export const Link = router.Link.bind(router);
