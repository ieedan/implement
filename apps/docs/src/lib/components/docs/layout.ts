import {
	A,
	Aside,
	derived,
	Div,
	Main,
	Nav,
	navigateTo,
	signal,
	Span,
	type Mountable,
} from "@implementjs/core";
import type { Page } from "@/lib/content";
import { router } from "../../router";
import { SiteHeader } from "../site-header";
import { MenuIcon } from "@implementjs/lucide";
import { Sheet, SheetContent, SheetOverlay, SheetTitle, SheetTrigger } from "../ui/sheet";

type DocsSection = { name: string; pages: Page[] };

/** Which content collection a docs layout navigates, and what to call it. */
export type DocsCollection = { pages: Page[]; label: string };

function docsSections(collection: Page[]): DocsSection[] {
	const sections: DocsSection[] = [];
	for (const page of collection) {
		const last = sections[sections.length - 1];
		if (last != null && last.name === page.section) last.pages.push(page);
		else sections.push({ name: page.section, pages: [page] });
	}
	return sections;
}

function DocsNav(collection: Page[], onNavigate?: () => void): Mountable {
	return Nav(
		{ class: "flex flex-col gap-5" },
		...docsSections(collection).map((section) =>
			Div(
				Span(
					{
						class: "px-3 text-[11px] font-medium uppercase tracking-wide text-foreground/40",
					},
					section.name,
				),
				Div(
					{ class: "mt-1.5 flex flex-col gap-1" },
					...section.pages.map((page) =>
						A(
							{
								href: page.permalink,
								class:
									"rounded-md px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground aria-[current=page]:bg-foreground/10 aria-[current=page]:text-foreground",
								"aria-current": derived([router.location], (location) =>
									location.path === page.permalink ? "page" : undefined,
								),
								onClick(event) {
									if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
									if (event.button !== 0) return;
									event.preventDefault();
									onNavigate?.();
									navigateTo(page.permalink);
								},
							},
							page.title,
						),
					),
				),
			),
		),
	);
}

// Required, not defaulted — see the note on `DocsPage`.
export function DocsLayout(child: Mountable, collection: DocsCollection): Mountable {
	const menuOpen = signal(false);
	const currentTitle = derived(
		[router.location],
		(location) =>
			collection.pages.find((page) => page.permalink === location.path)?.title ?? "Menu",
	);

	return Div(
		{ class: "flex min-h-dvh flex-col" },
		SiteHeader(),
		// The mobile nav is a sheet over the dialog primitive: the sticky bar's
		// button is its trigger, so dismissal, focus, and aria come for free.
		Sheet(
			{ open: menuOpen },
			Div(
				{
					class:
						"sticky top-12 z-10 flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-2 md:hidden",
				},
				SheetTrigger({ "aria-label": "Open docs navigation" }, MenuIcon({ class: "size-4" })),
				Span({ class: "min-w-0 truncate text-sm text-foreground/60" }, currentTitle),
			),
			SheetOverlay({ class: "md:hidden" }),
			SheetContent(
				{ side: "left", class: "md:hidden" },
				Div({ class: "border-b border-border px-4 py-3" }, SheetTitle({}, collection.label)),
				Div(
					{ class: "flex-1 overflow-y-auto px-3 py-4" },
					DocsNav(collection.pages, () => menuOpen.set(false)),
				),
			),
		),
		Div(
			{ class: "mx-auto flex w-full max-w-5xl flex-1 xl:max-w-7xl" },
			Aside(
				{
					class:
						"sticky top-12 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 self-start overflow-y-auto border-r border-border py-6 pr-4 md:block",
				},
				DocsNav(collection.pages),
			),
			Main({ class: "min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8" }, child),
		),
	);
}
