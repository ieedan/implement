import { Div, Implement, signal, type Mountable } from "@implementjs/core";
import { SiteHeader } from "../components/site-header";
import { Playground } from "../components/tutorials/playground";
import replExample from "../content/repl-example.ts?raw";
import { stripLessonSource } from "../lib/lesson-source";

export function ReplPage(): Mountable {
	const code = signal(stripLessonSource(replExample));

	return Div(
		{ class: "flex h-dvh flex-col overflow-hidden" },
		Implement.Head(
			Implement.Head.Title("repl ~ implement"),
			Implement.Head.Meta({
				name: "description",
				content: "Play with implement in the browser — live preview and console included.",
			}),
		),
		SiteHeader(),
		Playground(code, { consoleOpen: true, splitRight: true }),
	);
}
