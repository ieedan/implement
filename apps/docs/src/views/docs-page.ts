import { A, Article, Div, H1, Implement, navigateTo, P, Span, type Mountable } from "@implementjs/core";
import { Typeset } from "../components/docs/typeset";
import { pages, type Page } from "../lib/content";

function PageLink(page: Page, direction: "prev" | "next"): Mountable {
	return A(
		{
			href: page.permalink,
			class: [
				"flex min-w-0 flex-col gap-0.5 rounded-md px-3 py-2 hover:bg-foreground/5",
				direction === "next" && "items-end text-right",
			],
			onClick(event) {
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				if (event.button !== 0) return;
				event.preventDefault();
				navigateTo(page.permalink);
			},
		},
		Span({ class: "text-xs text-foreground/40" }, direction === "prev" ? "Previous" : "Next"),
		Span({ class: "truncate text-sm text-foreground" }, page.title),
	);
}

export function DocsPage(page: Page): Mountable {
	const index = pages.findIndex((item) => item.permalink === page.permalink);
	const prev = index > 0 ? pages[index - 1] : undefined;
	const next = index >= 0 ? pages[index + 1] : undefined;

	return Article(
		{ class: "mx-auto max-w-3xl space-y-4" },
		Implement.Head(
			Implement.Head.Title(`${page.title} ~ implement`),
			Implement.Head.Meta({ name: "description", content: page.description }),
		),

		H1({ class: "text-3xl font-semibold tracking-tight" }, page.title),
		P({ class: "text-lg text-foreground/60" }, page.description),
		Typeset(page.content, "space-y-4"),
		Div(
			{ class: "mt-10 flex items-center justify-between gap-2 border-t border-border pt-4" },
			prev ? PageLink(prev, "prev") : Span(),
			next ? PageLink(next, "next") : Span(),
		),
	);
}
