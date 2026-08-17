import {
	A,
	Aside,
	derived,
	Div,
	Header,
	Main,
	Nav,
	navigateTo,
	type Mountable,
} from "@packages/implement";
import { pages } from "../../lib/content";
import { router } from "../../router";

export function DocsLayout(child: Mountable): Mountable {
	return Div(
		{ class: "flex min-h-dvh flex-col" },
		Header(
			{ class: "flex h-14 items-center border-b border-border px-6" },
			router.Link({ to: "/", class: "text-sm font-semibold tracking-tight" }, "implement"),
		),
		Div(
			{ class: "mx-auto flex w-full max-w-5xl flex-1" },
			Aside(
				{ class: "w-56 shrink-0 border-r border-border py-6 pr-4" },
				Nav(
					{ class: "flex flex-col gap-1" },
					...pages.map((page) =>
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
									navigateTo(page.permalink);
								},
							},
							page.title,
						),
					),
				),
			),
			Main({ class: "min-w-0 flex-1 px-8 py-6" }, child),
		),
	);
}
