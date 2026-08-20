import {
	Button,
	derived,
	Div,
	If,
	Input,
	Key,
	signal,
	Span,
	type Mountable,
	type Signal,
	type Writable,
} from "@implementjs/core";
import { RefreshCwIcon, TerminalIcon } from "@implementjs/lucide";
import type { ConsoleEntry } from "@/lib/console-format";
import { countLessonRoutes, isKitLesson } from "@/lib/run-kit-lesson";
import { ConsolePanel } from "./console-panel";
import { CodeEditor } from "./editor";
import { FileTree } from "./file-tree";
import { LessonPreview } from "./preview";

/** One editable playground file; single-file lessons pass one `index.ts`. */
export type PlaygroundFile = { path: string; content: Writable<string> };

export type PlaygroundOptions = {
	/** Open the console panel initially. */
	consoleOpen?: boolean;
	/** Dock the console beside the preview instead of below it. */
	splitRight?: boolean;
	/** Path of the file open in the editor initially. @default the first file */
	focus?: string;
};

function UrlBar(urlPath: Signal<string>): Mountable {
	return Input({
		class:
			"w-full min-w-0 max-w-72 rounded-md bg-foreground/5 px-2 py-0.5 font-mono text-[11px] text-foreground/80 outline-none focus:bg-foreground/10 focus:text-foreground",
		// One-way: typing stays local to the input; Enter commits, and outside
		// navigation (link clicks in the preview) writes the bar.
		value: derived([urlPath], (value) => value),
		spellcheck: false,
		autocomplete: "off",
		"aria-label": "Preview URL",
		onKeydown(event) {
			if (event.key !== "Enter") return;
			const raw = (event.currentTarget as HTMLInputElement).value.trim();
			urlPath.set(raw === "" ? "/" : raw.startsWith("/") ? raw : `/${raw}`);
		},
	});
}

export function Playground(files: PlaygroundFile[], options: PlaygroundOptions = {}): Mountable {
	const tick = signal(0);
	const logs = signal<ConsoleEntry[]>([]);
	const consoleOpen = signal(options.consoleOpen ?? false);
	const splitRight = signal(options.splitRight ?? false);

	const paths = files.map((file) => file.path);
	const byPath = new Map(files.map((file) => [file.path, file.content]));
	const active = signal(
		options.focus != null && byPath.has(options.focus) ? options.focus : (paths[0] ?? ""),
	);
	const snapshot = derived(
		files.map((file) => file.content),
		() => files.map((file) => ({ path: file.path, content: file.content.get() })),
	);

	// The lesson's file set is fixed, so the route count (and the URL bar) is too.
	const showUrlBar = countLessonRoutes(files) > 1;
	const urlPath = signal(isKitLesson(files) ? "/" : "");
	// Kit lessons always show the tree — the project structure is the lesson.
	const showTree = files.length > 1 || isKitLesson(files);

	const hasErrors = derived([logs, consoleOpen], (entries, open) => {
		return !open && entries.some((entry) => entry.level === "error");
	});

	// Stacked console borrows height from the editor (5:3 becomes 5:3:2); the
	// side-by-side console shares the preview row instead.
	const previewGroupClass = derived([consoleOpen, splitRight], (open, right) => {
		return `flex min-h-0 min-w-0 ${open && !right ? "flex-[5]" : "flex-[3]"} ${right ? "flex-row" : "flex-col"}`;
	});
	const consoleGroupClass = derived([splitRight], (right) => {
		return `flex min-h-0 min-w-0 flex-[2] flex-col border-border ${right ? "border-l" : "border-t"}`;
	});

	return Div(
		{ class: "flex min-h-0 min-w-0 flex-1 flex-col" },
		Div(
			{ class: "flex min-h-0 flex-[5] flex-col border-b border-border" },
			Div(
				{ class: "flex h-9 shrink-0 items-center gap-2 border-b border-border px-3" },
				Span(
					{
						class:
							"truncate rounded-md bg-foreground/10 px-2 py-0.5 font-mono text-[11px] text-foreground/80",
					},
					derived([active], (path) => path),
				),
			),
			Div(
				{ class: "flex min-h-0 flex-1" },
				showTree && FileTree(paths, active),
				Div(
					{ class: "min-h-0 min-w-0 flex-1" },
					Key(active, () => CodeEditor(byPath.get(active.get())!)()),
				),
			),
		),
		Div(
			{ class: previewGroupClass },
			Div(
				{ class: "flex min-h-0 min-w-0 flex-[3] flex-col" },
				Div(
					{
						class:
							"flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3",
					},
					showUrlBar
						? Div({ class: "flex min-w-0 flex-1 items-center" }, UrlBar(urlPath))
						: Span(
								{ class: "text-[11px] font-medium uppercase tracking-wide text-foreground/40" },
								"Preview",
							),
					Div(
						{ class: "flex items-center gap-1" },
						Button(
							{
								type: "button",
								class:
									"relative rounded-md p-1 text-foreground/50 hover:bg-foreground/5 hover:text-foreground",
								"aria-label": "Toggle console",
								"aria-expanded": derived([consoleOpen], (open) => (open ? "true" : "false")),
								onClick: () => consoleOpen.toggle(),
							},
							TerminalIcon({ class: "size-3.5" }),
							If(hasErrors).Then(
								Span({
									class: "absolute right-0 top-0 size-1.5 rounded-full bg-red-400",
								}),
							),
						),
						Button(
							{
								type: "button",
								class:
									"rounded-md p-1 text-foreground/50 hover:bg-foreground/5 hover:text-foreground",
								"aria-label": "Reload preview",
								onClick: () => tick.increment(),
							},
							RefreshCwIcon({ class: "size-3.5" }),
						),
					),
				),
				Div({ class: "min-h-0 flex-1" }, LessonPreview(snapshot, tick, logs, urlPath)),
			),
			If(consoleOpen).Then(
				Div(
					{ class: consoleGroupClass },
					ConsolePanel(logs, () => consoleOpen.set(false), splitRight),
				),
			),
		),
	);
}
