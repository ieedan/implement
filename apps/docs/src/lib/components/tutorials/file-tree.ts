import { Button, derived, Div, Span, type Mountable, type Signal } from "@implementjs/core";
import { ChevronRightIcon, FileIcon, FolderIcon, FolderOpenIcon } from "@implementjs/lucide";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@implementjs/primitives";

type TreeEntry = {
	name: string;
	/** Full lesson path for files; `null` for folders. */
	path: string | null;
	children: TreeEntry[];
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

function TreeRow(entry: TreeEntry, depth: number, active: Signal<string>): Mountable {
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
			CollapsibleContent({}, ...entry.children.map((child) => TreeRow(child, depth + 1, active))),
		);
	}

	const path = entry.path;
	return Button(
		{
			type: "button",
			class: derived([active], (current) => [
				"flex w-full items-center gap-1.5 py-1 pr-2 text-left",
				current === path
					? "bg-foreground/10 text-foreground"
					: "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
			]),
			style: indent(18),
			"aria-current": derived([active], (current) => (current === path ? "true" : undefined)),
			onClick: () => active.set(path),
		},
		FileIcon({ class: "size-3.5 shrink-0" }),
		Span({ class: "truncate font-mono text-xs" }, entry.name),
	);
}

/** The lesson's files as a fixed tree; folders collapse, clicking a file opens it. */
export function FileTree(paths: readonly string[], active: Signal<string>): Mountable {
	const entries = buildTree(paths);
	return Div(
		{
			class: "w-44 shrink-0 overflow-y-auto border-r border-border py-2 lg:w-40 xl:w-44 2xl:w-48",
		},
		...entries.map((entry) => TreeRow(entry, 0, active)),
	);
}
