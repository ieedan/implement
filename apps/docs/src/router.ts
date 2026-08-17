import { Router } from "@packages/implement";
import { GettingStartedView } from "./views/getting-started";
import { HomeView } from "./views/home";
import { NotFound } from "./views/not-found";
import { DocsShell } from "./views/shell";

export const router = Router(
	{
		layout: (child) => DocsShell(child),
		"/": () => HomeView(),
		"/docs": {
			"/getting-started": {
				"/": () => GettingStartedView(),
			},
		},
	},
	{ fallback: () => NotFound() },
);
