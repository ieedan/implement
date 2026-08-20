import {
	Button,
	derived,
	Div,
	If,
	Implement,
	Input,
	Key,
	signal,
	Span,
	type Mountable,
	type Readable,
	type Signal,
	type Writable,
} from "@implementjs/core";
import { RefreshCwIcon, TerminalIcon } from "@implementjs/lucide";
import type { ConsoleEntry } from "@/lib/console-format";
import type { LessonFile } from "@/lib/content";
import { countLessonRoutes, isKitLesson } from "@/lib/run-kit-lesson";
import { ConsolePanel } from "./console-panel";
import { CodeEditor } from "./editor";
import { FileTree, type FileTreeActions } from "./file-tree";
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

/**
 * Subscribes to the file list and to every file's content — resubscribing as
 * files come and go — and calls `onChange` for any of it. Returns a stop.
 */
export function watchLessonFiles(
	files: Readable<PlaygroundFile[]>,
	onChange: () => void,
): () => void {
	let stops: (() => void)[] = [];
	const resubscribe = () => {
		for (const stop of stops) stop();
		stops = files.get().map((file) => file.content.onChange(onChange));
	};
	const stopList = files.onChange(() => {
		resubscribe();
		onChange();
	});
	resubscribe();
	return () => {
		stopList();
		for (const stop of stops) stop();
	};
}

function UrlBar(urlPath: Signal<string>): Mountable {
	return Input({
		class:
			"w-full min-w-0 flex-1 rounded-md bg-foreground/5 px-2 py-0.5 font-mono text-[11px] text-foreground/80 outline-none focus:bg-foreground/10 focus:text-foreground",
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

/** `about/index.ts` from ` /about/index.ts/ ` — or `null` when it can't be a file path. */
function normalizeNewPath(raw: string): string | null {
	const trimmed = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
	if (trimmed === "") return null;
	const segments = trimmed.split("/");
	if (segments.some((segment) => segment.trim() === "" || segment === "." || segment === "..")) {
		return null;
	}
	return segments.map((segment) => segment.trim()).join("/");
}

export function Playground(
	files: Signal<PlaygroundFile[]>,
	options: PlaygroundOptions = {},
): Mountable {
	const tick = signal(0);
	const logs = signal<ConsoleEntry[]>([]);
	const consoleOpen = signal(options.consoleOpen ?? false);
	const splitRight = signal(options.splitRight ?? false);

	const initial = files.get();
	const kitLesson = isKitLesson(initial);
	const paths = derived([files], (list) => list.map((file) => file.path));
	const contentFor = (path: string): Writable<string> | null =>
		files.get().find((file) => file.path === path)?.content ?? null;

	const active = signal(
		options.focus != null && initial.some((file) => file.path === options.focus)
			? options.focus
			: (initial[0]?.path ?? ""),
	);

	const currentSnapshot = (): LessonFile[] =>
		files.get().map((file) => ({ path: file.path, content: file.content.get() }));
	// Membership is dynamic, so this is a plain signal refreshed by
	// watchLessonFiles below instead of a derived over a fixed dep list.
	const snapshot = signal<LessonFile[]>(currentSnapshot());

	const showUrlBar = derived([snapshot], (list) => countLessonRoutes(list) > 1);
	const urlPath = signal(kitLesson ? "/" : "");
	// Kit lessons always show the tree — the project structure is the lesson.
	const showTree = initial.length > 1 || kitLesson;

	const report = (message: string) => window.alert(message);

	/** Why `path` can't be created, or `null` when it can. */
	const pathConflict = (path: string): string | null => {
		for (const file of files.get()) {
			if (file.path === path) return `${path} already exists.`;
			if (file.path.startsWith(`${path}/`)) return `${path} is a folder.`;
			if (path.startsWith(`${file.path}/`)) return `${file.path} is a file, not a folder.`;
		}
		return null;
	};

	const addFile = (raw: string) => {
		const path = normalizeNewPath(raw);
		if (path == null) return report("That's not a valid file path.");
		if (!/\.[a-z0-9]+$/i.test(path)) return report("Give the file an extension — e.g. index.ts.");
		const conflict = pathConflict(path);
		if (conflict != null) return report(conflict);
		files.set([...files.get(), { path, content: signal("") }]);
		active.set(path);
	};

	const renameFile = (from: string, raw: string) => {
		const to = normalizeNewPath(raw);
		if (to == null) return report("That's not a valid file path.");
		if (to === from) return;
		if (!/\.[a-z0-9]+$/i.test(to)) return report("Give the file an extension — e.g. index.ts.");
		const conflict = pathConflict(to);
		if (conflict != null) return report(conflict);
		files.set(
			files.get().map((file) => (file.path === from ? { path: to, content: file.content } : file)),
		);
		if (active.get() === from) active.set(to);
	};

	const removeFile = (path: string) => {
		const remaining = files.get().filter((file) => file.path !== path);
		files.set(remaining);
		if (active.get() === path) active.set(remaining[0]?.path ?? "");
	};

	// Only kit lessons edit their file set — the project structure is the point.
	const treeActions: FileTreeActions | null = kitLesson
		? { add: addFile, rename: renameFile, remove: removeFile }
		: null;

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
		Implement.Lifecycle({
			onMount: () => watchLessonFiles(files, () => snapshot.set(currentSnapshot())),
		}),
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
				showTree && FileTree(paths, active, treeActions),
				Div(
					{ class: "min-h-0 min-w-0 flex-1" },
					Key(active, () => {
						const content = contentFor(active.get());
						return content == null
							? Div(
									{ class: "p-4 text-xs text-foreground/40" },
									"No file open — create one in the tree.",
								)()
							: CodeEditor(content)();
					}),
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
					If(showUrlBar)
						.Then(Div({ class: "flex min-w-0 flex-1 items-center" }, UrlBar(urlPath)))
						.Else(
							Span(
								{ class: "text-[11px] font-medium uppercase tracking-wide text-foreground/40" },
								"Preview",
							),
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
