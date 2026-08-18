import { derived, Header, Nav, type Mountable } from "@implementjs/core";
import { router } from "../router";

function navClass(active: boolean): string {
	return active ? "text-sm text-foreground" : "text-sm text-foreground/50 hover:text-foreground";
}

export function SiteHeader(): Mountable {
	const onDocs = derived(
		[router.location],
		(location) => location.path === "/docs" || location.path.startsWith("/docs/"),
	);
	const onTutorial = derived(
		[router.location],
		(location) => location.path === "/tutorial" || location.path.startsWith("/tutorial/"),
	);
	const onRepl = derived(
		[router.location],
		(location) => location.path === "/repl" || location.path.startsWith("/repl/"),
	);

	return Header(
		{ class: "flex h-12 shrink-0 items-center gap-6 border-b border-border px-4" },
		router.Link({ to: "/", class: "text-sm font-semibold tracking-tight" }, "implement"),
		Nav(
			{ class: "flex items-center gap-4" },
			router.Link({ to: "/docs", class: derived([onDocs], (active) => navClass(active)) }, "Docs"),
			router.Link(
				{ to: "/tutorial", class: derived([onTutorial], (active) => navClass(active)) },
				"Tutorial",
			),
			router.Link({ to: "/repl", class: derived([onRepl], (active) => navClass(active)) }, "REPL"),
		),
	);
}
