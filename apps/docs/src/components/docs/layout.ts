import {
	A,
	Aside,
	Button as ButtonPrimitive,
	derived,
	Div,
	H2,
	Implement,
	Main,
	Nav,
	navigateTo,
	signal,
	Span,
	type Mountable,
	type Writable,
} from "@implementjs/core";
import { pages, type Page } from "../../lib/content";
import { router } from "../../router";
import { SiteHeader } from "../site-header";
import { MenuIcon } from "@implementjs/lucide";
import { Button } from "../ui/button";

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

function DocsMenu(
	open: Writable<boolean>,
	{ pages: collection, label }: DocsCollection,
): Mountable {
	return Div(
		{
			class: derived([open], (isOpen) => [
				"fixed inset-0 z-20 md:hidden",
				!isOpen && "pointer-events-none",
			]),
		},
		Implement.Window({
			onKeydown: (event) => {
				if (event.key === "Escape" && open.get()) open.set(false);
			},
		}),
		ButtonPrimitive({
			type: "button",
			tabIndex: derived([open], (isOpen) => (isOpen ? 0 : -1)),
			class: derived([open], (isOpen) => [
				"absolute inset-0 bg-black/60 transition-opacity",
				isOpen ? "opacity-100" : "opacity-0",
			]),
			"aria-label": "Close docs navigation",
			onClick: () => open.set(false),
		}),
		Aside(
			{
				class: derived([open], (isOpen) => [
					"absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background transition-transform",
					isOpen ? "translate-x-0" : "-translate-x-full",
				]),
				inert: derived([open], (isOpen) => !isOpen),
			},
			Div(
				{ class: "flex items-center justify-between border-b border-border px-4 py-3" },
				H2({ class: "text-sm font-semibold" }, label),
				ButtonPrimitive(
					{
						type: "button",
						class: "rounded-md px-2 py-1 text-xs text-foreground/60 hover:text-foreground",
						onClick: () => open.set(false),
					},
					"Close",
				),
			),
			Div(
				{ class: "flex-1 overflow-y-auto px-3 py-4" },
				DocsNav(collection, () => open.set(false)),
			),
		),
	);
}

export function DocsLayout(
	child: Mountable,
	collection: DocsCollection = { pages, label: "Docs" },
): Mountable {
	const menuOpen = signal(false);
	const currentTitle = derived(
		[router.location],
		(location) =>
			collection.pages.find((page) => page.permalink === location.path)?.title ?? "Menu",
	);

	return Div(
		{ class: "flex min-h-dvh flex-col" },
		SiteHeader(),
		Div(
			{
				class:
					"sticky top-12 z-10 flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-2 md:hidden",
			},
			Button(
				{
					variant: "ghost",
					size: "icon-sm",
					"aria-label": "Open docs navigation",
					"aria-expanded": derived([menuOpen], (open) => (open ? "true" : "false")),
					onClick: () => menuOpen.toggle(),
				},
				MenuIcon({ class: "size-4" }),
			),
			Span({ class: "min-w-0 truncate text-sm text-foreground/60" }, currentTitle),
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
		DocsMenu(menuOpen, collection),
	);
}
