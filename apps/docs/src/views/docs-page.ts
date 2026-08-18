import { Article, H1, Implement, P, type Mountable } from "@implementjs/core";
import { Typeset } from "../components/docs/typeset";
import type { Page } from "../lib/content";

export function DocsPage(page: Page): Mountable {
	return Article(
		{ class: "mx-auto max-w-3xl space-y-4" },
		Implement.Head(
			Implement.Head.Title(`${page.title} ~ implement`),
			Implement.Head.Meta({ name: "description", content: page.description }),
		),

		H1({ class: "text-3xl font-semibold tracking-tight" }, page.title),
		P({ class: "text-lg text-foreground/60" }, page.description),
		Typeset(page.content, "space-y-4"),
	);
}
