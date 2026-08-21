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
import type { LessonFile } from "@/lib/tutorials";
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
	/**
	 * File paths the exercise expects the user to create — the only ones the
	 * file tree's create controls accept. Without any, the tree is read-only.
	 */
	creatable?: string[];
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
			const raw = event.currentTarget.value.trim();
			urlPath.set(raw === "" ? "/" : raw.startsWith("/") ? raw : `/${raw}`);
		},
	});
}

/** `about/page.ts` from ` /about/page.ts/ ` — or `null` when it can't be a file path. */
function normalizeNewPath(raw: string): string | null {
	const trimmed = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
	if (trimmed === "") return null;
	const segments = trimmed.split("/");
	if (segments.some((segment) => segment.trim() === "" || segment === "." || segment === "..")) {
		return null;
	}
	return segments.map((segment) => segment.trim()).join("/");
}

const reportPlaygroundMessage = (message: string) => window.alert(message);

const dirPrefixes = (path: string): string[] => {
	const segments = path.split("/");
	return segments.slice(1, -1).map((_, index) => segments.slice(0, index + 2).join("/"));
};

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

	// Folders exist implicitly through file paths; explicitly created (still
	// empty) ones live here until a file lands inside or a Reset clears them.
	const extraDirs = signal<string[]>([]);

	// Like the Svelte tutorial, lessons only allow creating the specific files
	// the exercise expects (folders come along as their parents) — so there is
	// never a wrong file to clean up.
	const creatable = options.creatable ?? [];
	const allowedFiles = new Set(creatable);
	// only folders the starter doesn't already have count as creatable
	const starterDirs = new Set(initial.flatMap((file) => dirPrefixes(file.path)));
	const allowedDirs = new Set(
		creatable.flatMap(dirPrefixes).filter((dir) => !starterDirs.has(dir)),
	);

	const notAllowed = () => {
		const listing = [...allowedDirs, ...allowedFiles].toSorted().join("\n");
		reportPlaygroundMessage(
			`This action is not allowed.\n\nOnly the following files and folders can be created in this exercise:\n\n${listing}`,
		);
	};

	/** Every folder the tree shows: prefixes of file paths plus the empty extras. */
	const allDirs = (): Set<string> => {
		const dirs = new Set(extraDirs.get());
		for (const file of files.get()) {
			const segments = file.path.split("/");
			for (let i = 1; i < segments.length; i++) {
				dirs.add(segments.slice(0, i).join("/"));
			}
		}
		return dirs;
	};

	const addFile = (raw: string) => {
		const path = normalizeNewPath(raw);
		if (path == null) return reportPlaygroundMessage("That's not a valid file path.");
		if (!allowedFiles.has(path)) return notAllowed();
		if (files.get().some((file) => file.path === path))
			return reportPlaygroundMessage(`${path} already exists.`);
		files.set([...files.get(), { path, content: signal("") }]);
		active.set(path);
	};

	const addFolder = (raw: string) => {
		const path = normalizeNewPath(raw);
		if (path == null) return reportPlaygroundMessage("That's not a valid folder path.");
		if (!allowedDirs.has(path)) return notAllowed();
		if (allDirs().has(path)) return reportPlaygroundMessage(`${path} already exists.`);
		extraDirs.set([...extraDirs.get(), path]);
	};

	const starterPaths = new Set(initial.map((file) => file.path));
	const created = derived([paths], (list) => list.filter((path) => !starterPaths.has(path)));

	const removeFile = (path: string) => {
		// only files the user created carry a delete control
		if (starterPaths.has(path)) return;
		const remaining = files.get().filter((file) => file.path !== path);
		files.set(remaining);
		if (active.get() === path) active.set(remaining[0]?.path ?? "");
	};

	// Create icons only show above directories something is still missing in:
	// a folder row (or the root, for single-segment paths) whose subtree has an
	// expected file or folder that doesn't exist yet.
	const canCreateFile = (dir: string): boolean =>
		[...allowedFiles].some(
			(path) =>
				!files.get().some((file) => file.path === path) &&
				(dir === "" ? !path.includes("/") : path.startsWith(`${dir}/`)),
		);
	const canCreateFolder = (dir: string): boolean => {
		const existing = allDirs();
		return [...allowedDirs].some(
			(folder) =>
				!existing.has(folder) &&
				(dir === "" ? !folder.includes("/") : folder.startsWith(`${dir}/`)),
		);
	};

	const treeActions: FileTreeActions | null =
		kitLesson && creatable.length > 0
			? { addFile, addFolder, canCreateFile, canCreateFolder, removeFile, created }
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
			onMount: () =>
				watchLessonFiles(files, () => {
					snapshot.set(currentSnapshot());
					// the open file can vanish under us (Reset, a folder delete)
					if (contentFor(active.get()) == null) {
						active.set(files.get()[0]?.path ?? "");
					}
				}),
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
				showTree && FileTree(paths, extraDirs, active, treeActions),
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
