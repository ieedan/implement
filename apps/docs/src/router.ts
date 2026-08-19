import { Router } from "@implementjs/core";
import { docsRoutes, lucideDocsRoutes, primitivesDocsRoutes } from "./lib/docs-routes";
import { tutorialRoutes } from "./lib/tutorial-routes";
import { Home } from "./views/home";
import { NotFound } from "./views/not-found";
import { PackagesPage } from "./views/packages";
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
		"/lucide": lucideDocsRoutes(),
		"/packages": () => PackagesPage(),
		"/tutorial": tutorialRoutes(),
		"/repl": () => ReplPage(),
	},
	{ fallback: () => NotFound() },
);

export const Link = router.Link.bind(router);
