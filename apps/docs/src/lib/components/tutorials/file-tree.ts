import {
	Button,
	derived,
	Div,
	Key,
	Span,
	type Mountable,
	type Readable,
	type Signal,
} from "@implementjs/core";
import {
	ChevronRightIcon,
	FileIcon,
	FilePenLineIcon,
	FilePlus2Icon,
	FolderIcon,
	FolderOpenIcon,
	XIcon,
} from "@implementjs/lucide";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@implementjs/primitives";

type TreeEntry = {
	name: string;
	/** Full lesson path for files; `null` for folders. */
	path: string | null;
	children: TreeEntry[];
};

/** Add, rename (full path — renaming can move a file), and delete. */
export type FileTreeActions = {
	add: (path: string) => void;
	rename: (from: string, to: string) => void;
	remove: (path: string) => void;
};

/** Nested tree from the lesson's file paths, folders first at every level. */
function buildTree(paths: readonly string[]): TreeEntry[] {
	const root: TreeEntry = { name: "", path: null, children: [] };
	for (const path of paths) {
		const segments = path.split("/");
		let node = root;
		for (const [index, segment] of segments.entries()) {
			const isFile = index === segments.length - 1;
			let child = node.children.find((entry) => entry.name === segment);
			if (child == null) {
				child = { name: segment, path: isFile ? path : null, children: [] };
				node.children.push(child);
			}
			node = child;
		}
	}
	const sort = (entries: TreeEntry[]) => {
		entries.sort((a, b) => {
			const aFolder = a.path === null ? 0 : 1;
			const bFolder = b.path === null ? 0 : 1;
			if (aFolder !== bFolder) return aFolder - bFolder;
			return a.name.localeCompare(b.name);
		});
		for (const entry of entries) sort(entry.children);
	};
	sort(root.children);
	return root.children;
}

const rowActionClass =
	"hidden shrink-0 rounded p-0.5 text-foreground/40 hover:bg-foreground/10 hover:text-foreground group-hover:block";

function TreeRow(
	entry: TreeEntry,
	depth: number,
	active: Signal<string>,
	actions: FileTreeActions | null,
): Mountable {
	// Files sit past the folders' chevron (size-3 plus the gap), so names at
	// one depth line up.
	const indent = (extra: number) => ({ paddingLeft: `${depth * 12 + 8 + extra}px` });

	if (entry.path === null) {
		// Bare primitives instead of the ui wrapper: the trigger is a compact
		// tree row, not a button-variant button.
		return Collapsible(
			{ open: true },
			CollapsibleTrigger(
				{
					class:
						"group flex w-full items-center gap-1.5 py-1 pr-2 text-left text-foreground/50 hover:text-foreground/80",
					style: indent(0),
				},
				ChevronRightIcon({
					class: "size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90",
				}),
				FolderIcon({ class: "size-3.5 shrink-0 group-data-[state=open]:hidden" }),
				FolderOpenIcon({ class: "hidden size-3.5 shrink-0 group-data-[state=open]:block" }),
				Span({ class: "truncate text-xs" }, entry.name),
			),
			CollapsibleContent(
				{},
				...entry.children.map((child) => TreeRow(child, depth + 1, active, actions)),
			),
		);
	}

	const path = entry.path;
	return Div(
		{
			class: derived([active], (current) => [
				"group flex w-full items-center gap-1.5 py-1 pr-1",
				current === path
					? "bg-foreground/10 text-foreground"
					: "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
			]),
			style: indent(18),
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
		actions &&
			Button(
				{
					type: "button",
					class: rowActionClass,
					"aria-label": `Rename ${path}`,
					title: "Rename",
					onClick: () => {
						const next = window.prompt("Rename (the full path moves the file):", path);
						if (next != null) actions.rename(path, next);
					},
				},
				FilePenLineIcon({ class: "size-3" }),
			),
		actions &&
			Button(
				{
					type: "button",
					class: rowActionClass,
					"aria-label": `Delete ${path}`,
					title: "Delete",
					onClick: () => {
						if (window.confirm(`Delete ${path}?`)) actions.remove(path);
					},
				},
				XIcon({ class: "size-3" }),
			),
	);
}

/**
 * The lesson's files as a tree; folders collapse, clicking a file opens it.
 * With `actions`, files can be added (header button), renamed, and deleted —
 * the tree rebuilds whenever the path list changes.
 */
export function FileTree(
	paths: Readable<string[]>,
	active: Signal<string>,
	actions: FileTreeActions | null = null,
): Mountable {
	return Div(
		{
			class:
				"flex w-44 shrink-0 flex-col overflow-y-auto border-r border-border py-1 lg:w-40 xl:w-44 2xl:w-48",
		},
		actions &&
			Div(
				{ class: "flex items-center justify-end border-b border-border/60 px-2 pb-1" },
				Button(
					{
						type: "button",
						class:
							"flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-foreground/50 hover:bg-foreground/5 hover:text-foreground",
						"aria-label": "New file",
						onClick: () => {
							const path = window.prompt("New file path:", "src/routes/");
							if (path != null) actions.add(path);
						},
					},
					FilePlus2Icon({ class: "size-3" }),
					"New file",
				),
			),
		Div(
			{ class: "min-h-0 flex-1 overflow-y-auto py-1" },
			Key(
				derived([paths], (list) => list.join("\n")),
				() =>
					Div(
						{},
						...buildTree(paths.get()).map((entry) => TreeRow(entry, 0, active, actions)),
					)(),
			),
		),
	);
}
