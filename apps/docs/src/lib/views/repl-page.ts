import { derived, Div, Implement, signal, type Mountable } from "@implementjs/core";
import { SiteHeader } from "../components/site-header";
import { Playground, type PlaygroundFile } from "../components/tutorials/playground";
import replExample from "@/content/repl-example.ts?raw";
import { stripLessonSource } from "@/lib/lesson-source";
import { UnsavedChangesGuard } from "@/lib/unsaved-changes";

export function ReplPage(): Mountable {
	const example = stripLessonSource(replExample);
	const code = signal(example);
	const tainted = derived([code], (value) => value !== example);
	const files = signal<PlaygroundFile[]>([{ path: "index.ts", content: code }]);

	return Div(
		{ class: "flex h-dvh flex-col overflow-hidden" },
		Implement.Head(
			Implement.Head.Title("repl ~ implement"),
			Implement.Head.Meta({
				name: "description",
				content: "Play with implement in the browser — live preview and console included.",
			}),
		),
		UnsavedChangesGuard(tainted, "You have unsaved code in the REPL — leave anyway?"),
		SiteHeader(),
		Playground(files, { consoleOpen: true, splitRight: true }),
	);
}
