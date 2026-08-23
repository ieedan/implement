import { derived, Div, Header, Nav, signal, Span, type Mountable } from "@implementjs/core";
import { MenuIcon } from "@implementjs/lucide";
import { router } from "$implement/router";
import { DocsSearch } from "./docs/search";
import { Logo } from "./logo";
import { ModeToggle } from "./mode-toggle";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";

/** The top-level areas of the site, in the order the header lists them. */
const sections = [
	{ to: "/docs", label: "Docs" },
	{ to: "/kit", label: "Kit" },
	{ to: "/primitives", label: "Primitives" },
	{ to: "/ui", label: "UI" },
	{ to: "/packages", label: "Packages" },
	{ to: "/tutorial", label: "Tutorial" },
	{ to: "/repl", label: "REPL" },
] as const;

function navClass(active: boolean): string {
	return active ? "text-sm text-foreground" : "text-sm text-foreground/50 hover:text-foreground";
}

function menuLinkClass(active: boolean): string {
	return active
		? "rounded-md px-3 py-1.5 text-sm bg-foreground/10 text-foreground"
		: "rounded-md px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground";
}

export function SiteHeader(): Mountable {
	// a section owns its subtree, so `/ui/button` still lights up `UI` — which
	// `aria-current` alone would not do, since the router only matches the path
	const activeSection = derived([router.location], (location) =>
		sections.find(
			(section) => location.path === section.to || location.path.startsWith(`${section.to}/`),
		),
	);
	const menuOpen = signal(false);

	return Header(
		{
			class:
				"sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:gap-6",
		},
		router.Link(
			{
				to: "/",
				class: "flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight",
			},
			Logo({ class: "h-4 w-auto", "aria-hidden": true }),
			"implement",
		),
		// seven links and a search box do not fit a phone, or a tablet: below `lg`
		// they move into a sheet, whose trigger doubles as a "you are here" label
		Nav(
			{ class: "hidden items-center gap-4 lg:flex" },
			...sections.map((section) =>
				router.Link(
					{
						to: section.to,
						class: derived([activeSection], (active) => navClass(active?.to === section.to)),
					},
					section.label,
				),
			),
		),
		Sheet(
			{ open: menuOpen },
			SheetTrigger(
				{ size: "sm", class: "min-w-0 gap-2 lg:hidden" },
				MenuIcon({ class: "size-4 shrink-0", "aria-hidden": true }),
				// named rather than `aria-label`ed, so the accessible name keeps the
				// section the button shows instead of replacing it
				Span({ class: "sr-only" }, "Site navigation:"),
				Span(
					{ class: "truncate" },
					derived([activeSection], (active) => active?.label ?? "Menu"),
				),
			),
			SheetContent(
				{ side: "left", class: "lg:hidden", overlay: { class: "lg:hidden" } },
				Div(
					{ class: "border-b border-border px-4 py-3" },
					SheetTitle(
						{ class: "flex items-center gap-2 tracking-tight" },
						Logo({ class: "h-4 w-auto", "aria-hidden": true }),
						"implement",
					),
				),
				Nav(
					{ class: "flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" },
					...sections.map((section) =>
						router.Link(
							{
								to: section.to,
								class: derived([activeSection], (active) =>
									menuLinkClass(active?.to === section.to),
								),
								onClick: () => menuOpen.set(false),
							},
							section.label,
						),
					),
				),
			),
		),
		Div({ class: "ml-auto flex shrink-0 items-center gap-2" }, DocsSearch(), ModeToggle()),
	);
}
