import {
	Button,
	derived,
	Div,
	ImplementLifecycle,
	Input,
	Key,
	ref,
	signal,
	Span,
	type Mountable,
	type Readable,
	type Signal,
} from "@implementjs/core";
import {
	ChevronRightIcon,
	FileIcon,
	FilePlus2Icon,
	FolderIcon,
	FolderOpenIcon,
	FolderPlusIcon,
	XIcon,
} from "@implementjs/lucide";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@implementjs/primitives";

type TreeEntry = {
	name: string;
	/** Full lesson path for files; `null` for folders. */
	path: string | null;
	/** Full folder path, for folder rows. */
	dir: string | null;
	children: TreeEntry[];
};

/**
 * Creation the tree offers — lessons allow only the specific files and
 * folders the exercise needs. The `canCreate*` checks decide which folder
 * rows show create icons (`""` asks about the project root), so the icons
 * only appear above directories something can still be created in.
 */
export type FileTreeActions = {
	addFile: (path: string) => void;
	addFolder: (path: string) => void;
	/** Whether an expected file can still be created under `dir` (`""` = the root). */
	canCreateFile: (dir: string) => boolean;
	/** Whether an expected folder can still be created under `dir` (`""` = the root). */
	canCreateFolder: (dir: string) => boolean;
	/** Deletes a user-created file (only they carry a delete control). */
	removeFile: (path: string) => void;
	/** Paths the user created, deletable until a Reset. */
	created: Readable<string[]>;
};

/** An in-progress inline creation: which folder it lands in, and what kind. */
type Creating = { dir: string; kind: "file" | "folder" };

/** Nested tree from file paths plus explicitly created (possibly empty) folders. */
function sortTreeEntries(entries: TreeEntry[]): void {
	entries.splice(
		0,
		entries.length,
		...entries.toSorted((a, b) => {
			const aFolder = a.path === null ? 0 : 1;
			const bFolder = b.path === null ? 0 : 1;
			if (aFolder !== bFolder) return aFolder - bFolder;
			return a.name.localeCompare(b.name);
		}),
	);
	for (const entry of entries) sortTreeEntries(entry.children);
}

/** Nested tree from file paths plus explicitly created (possibly empty) folders. */
function buildTree(paths: readonly string[], dirs: readonly string[]): TreeEntry[] {
	const root: TreeEntry = { name: "", path: null, dir: null, children: [] };
	const insert = (segments: string[], filePath: string | null) => {
		let node = root;
		let prefix = "";
		for (const [index, segment] of segments.entries()) {
			prefix = prefix === "" ? segment : `${prefix}/${segment}`;
			const isFile = filePath !== null && index === segments.length - 1;
			let child = node.children.find((entry) => entry.name === segment);
			if (child == null) {
				child = {
					name: segment,
					path: isFile ? filePath : null,
					dir: isFile ? null : prefix,
					children: [],
				};
				node.children.push(child);
			}
			node = child;
		}
	};
	for (const dir of dirs) insert(dir.split("/"), null);
	for (const path of paths) insert(path.split("/"), path);
	sortTreeEntries(root.children);
	return root.children;
}

const actionClass =
	"hidden shrink-0 rounded p-0.5 text-foreground/40 hover:bg-foreground/10 hover:text-foreground group-hover:block";

const rowIndent = (depth: number, extra: number) => ({
	paddingLeft: `${depth * 12 + 8 + extra}px`,
});

/** The file+ / folder+ icons a folder row shows, scoped to creating inside it. */
function CreateButtons(
	actions: FileTreeActions,
	dir: string,
	creating: Signal<Creating | null>,
): (Mountable | false)[] {
	return [
		actions.canCreateFile(dir) &&
			Button(
				{
					type: "button",
					class: actionClass,
					"aria-label": dir === "" ? "New file" : `New file in ${dir}`,
					title: "New file",
					onClick: (event) => {
						event.stopPropagation();
						creating.set({ dir, kind: "file" });
					},
				},
				FilePlus2Icon({ class: "size-3" }),
			),
		actions.canCreateFolder(dir) &&
			Button(
				{
					type: "button",
					class: actionClass,
					"aria-label": dir === "" ? "New folder" : `New folder in ${dir}`,
					title: "New folder",
					onClick: (event) => {
						event.stopPropagation();
						creating.set({ dir, kind: "folder" });
					},
				},
				FolderPlusIcon({ class: "size-3" }),
			),
	];
}

/**
 * The inline name input a + icon opens, sitting where the new entry will
 * land. Enter creates (a name may contain `/` to go deeper in one step),
 * Escape or clicking away cancels.
 */
function CreateInput(
	actions: FileTreeActions,
	request: Creating,
	depth: number,
	creating: Signal<Creating | null>,
): Mountable {
	const inputRef = ref<HTMLInputElement>();
	let finished = false;
	const done = () => {
		if (finished) return;
		finished = true;
		creating.set(null);
	};
	const commit = () => {
		const name = inputRef.get()?.value.trim().replace(/^\/+/, "").replace(/\/+$/, "") ?? "";
		done();
		if (name === "") return;
		const path = request.dir === "" ? name : `${request.dir}/${name}`;
		if (request.kind === "file") actions.addFile(path);
		else actions.addFolder(path);
	};
	return Div(
		{ class: "flex items-center gap-1.5 py-1 pr-2", style: rowIndent(depth, 18) },
		request.kind === "file"
			? FileIcon({ class: "size-3.5 shrink-0 text-foreground/60" })
			: FolderIcon({ class: "size-3.5 shrink-0 text-foreground/60" }),
		Input({
			this: inputRef,
			class:
				// 16px on a phone, where anything smaller makes Safari zoom the page in
				"min-w-0 flex-1 rounded border border-ring bg-foreground/5 px-1 py-0.5 font-mono text-base text-foreground outline-none md:text-xs",
			spellcheck: false,
			autocomplete: "off",
			"aria-label": request.kind === "file" ? "New file name" : "New folder name",
			onKeydown(event) {
				if (event.key === "Enter") commit();
				else if (event.key === "Escape") done();
			},
			onBlur: () => done(),
		}),
		ImplementLifecycle({
			onMount: () => inputRef.get()?.focus(),
		}),
	);
}

function TreeRow(
	entry: TreeEntry,
	depth: number,
	active: Signal<string>,
	actions: FileTreeActions | null,
	creating: Signal<Creating | null>,
): Mountable {
	// Files sit past the folders' chevron (size-3 plus the gap), so names at
	// one depth line up.
	if (entry.path === null) {
		const dir = entry.dir!;
		const pending = creating.get();
		// Bare primitives instead of the ui wrapper: the trigger is a compact
		// tree row, not a button-variant button.
		return Collapsible(
			{ open: true },
			Div(
				{ class: "group flex w-full items-center gap-0.5 pr-1" },
				CollapsibleTrigger(
					{
						class:
							"group/trigger flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-foreground/50 hover:text-foreground/80",
						style: rowIndent(depth, 0),
					},
					ChevronRightIcon({
						class: "size-3 shrink-0 transition-transform group-data-[state=open]/trigger:rotate-90",
					}),
					FolderIcon({ class: "size-3.5 shrink-0 group-data-[state=open]/trigger:hidden" }),
					FolderOpenIcon({
						class: "hidden size-3.5 shrink-0 group-data-[state=open]/trigger:block",
					}),
					Span({ class: "truncate text-xs" }, entry.name),
				),
				...(actions ? CreateButtons(actions, dir, creating) : []),
			),
			CollapsibleContent(
				{},
				actions !== null &&
					pending !== null &&
					pending.dir === dir &&
					CreateInput(actions, pending, depth + 1, creating),
				...entry.children.map((child) => TreeRow(child, depth + 1, active, actions, creating)),
			),
		);
	}

	const path = entry.path;
	return Div(
		{
			class: derived([active], (current) => [
				"group flex w-full items-center gap-0.5 py-1 pr-1",
				current === path
					? "bg-foreground/10 text-foreground"
					: "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
			]),
			style: rowIndent(depth, 18),
		},
		Button(
			{
				type: "button",
				class: "flex min-w-0 flex-1 items-center gap-1.5 text-left",
				"aria-current": derived([active], (current) => (current === path ? "true" : undefined)),
				onClick: () => active.set(path),
			},
			FileIcon({ class: "size-3.5 shrink-0" }),
			Span({ class: "truncate font-mono text-xs" }, entry.name),
		),
		// membership changes rebuild the tree (Key below), so a static read is safe
		actions &&
			actions.created.get().includes(path) &&
			Button(
				{
					type: "button",
					class: actionClass,
					"aria-label": `Delete ${path}`,
					title: "Delete",
					onClick: () => {
						if (window.confirm(`Delete ${path}?`)) actions.removeFile(path);
					},
				},
				XIcon({ class: "size-3" }),
			),
	);
}

/**
 * The lesson's files as a tree; folders collapse, clicking a file opens it.
 * With `actions`, the exercise's expected files and folders can be created:
 * a folder row something can still be created under shows file+/folder+
 * icons on hover, which open an inline name input right where the entry
 * will land (the project root only gets them when a root-level path is
 * expected). A file the user created can be deleted again. The tree
 * rebuilds whenever the paths change.
 */
export function FileTree(
	paths: Readable<string[]>,
	dirs: Readable<string[]>,
	active: Signal<string>,
	actions: FileTreeActions | null = null,
): Mountable {
	const creating = signal<Creating | null>(null);
	const rootCreate = actions !== null && (actions.canCreateFile("") || actions.canCreateFolder(""));
	return Div(
		{
			class: "flex w-52 shrink-0 flex-col border-r border-border py-1 lg:w-48 xl:w-52 2xl:w-60",
		},
		rootCreate &&
			actions !== null &&
			Div(
				{
					class: "group flex items-center justify-end gap-0.5 border-b border-border/60 px-2 pb-1",
				},
				...CreateButtons(actions, "", creating),
			),
		Div(
			{ class: "min-h-0 flex-1 overflow-y-auto py-1" },
			Key(
				derived([paths, dirs, creating], (files, folders, pending) =>
					[...files, ...folders, pending === null ? "" : `+${pending.kind}:${pending.dir}`].join(
						"\n",
					),
				),
				() => {
					const pending = creating.get();
					return Div(
						{},
						actions !== null &&
							pending !== null &&
							pending.dir === "" &&
							CreateInput(actions, pending, 0, creating),
						...buildTree(paths.get(), dirs.get()).map((entry) =>
							TreeRow(entry, 0, active, actions, creating),
						),
					)();
				},
			),
		),
	);
}
