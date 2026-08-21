import { derived, Div, Header, Nav, type Mountable } from "@implementjs/core";
import { router } from "../router";
import { DocsSearch } from "./docs/search";
import { Logo } from "./logo";

function navClass(active: boolean): string {
	return active ? "text-sm text-foreground" : "text-sm text-foreground/50 hover:text-foreground";
}

export function SiteHeader(): Mountable {
	const onDocs = derived(
		[router.location],
		(location) => location.path === "/docs" || location.path.startsWith("/docs/"),
	);
	const onKit = derived(
		[router.location],
		(location) => location.path === "/kit" || location.path.startsWith("/kit/"),
	);
	const onPrimitives = derived(
		[router.location],
		(location) => location.path === "/primitives" || location.path.startsWith("/primitives/"),
	);
	const onUi = derived(
		[router.location],
		(location) => location.path === "/ui" || location.path.startsWith("/ui/"),
	);
	const onPackages = derived(
		[router.location],
		(location) => location.path === "/packages" || location.path.startsWith("/packages/"),
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
		{
			class:
				"sticky top-0 z-10 flex h-12 shrink-0 items-center gap-6 border-b border-border bg-background px-4",
		},
		router.Link(
			{ to: "/", class: "flex items-center gap-2 text-sm font-semibold tracking-tight" },
			Logo({ class: "h-4 w-auto", "aria-hidden": true }),
			"implement",
		),
		Nav(
			{ class: "flex items-center gap-4" },
			router.Link({ to: "/docs", class: derived([onDocs], (active) => navClass(active)) }, "Docs"),
			router.Link({ to: "/kit", class: derived([onKit], (active) => navClass(active)) }, "Kit"),
			router.Link(
				{ to: "/primitives", class: derived([onPrimitives], (active) => navClass(active)) },
				"Primitives",
			),
			router.Link({ to: "/ui", class: derived([onUi], (active) => navClass(active)) }, "UI"),
			router.Link(
				{ to: "/packages", class: derived([onPackages], (active) => navClass(active)) },
				"Packages",
			),
			router.Link(
				{ to: "/tutorial", class: derived([onTutorial], (active) => navClass(active)) },
				"Tutorial",
			),
			router.Link({ to: "/repl", class: derived([onRepl], (active) => navClass(active)) }, "REPL"),
		),
		Div({ class: "ml-auto flex items-center" }, DocsSearch()),
	);
}
