import { Button, derived, Div, Span, type Mountable, type Signal } from "@implementjs/core";
import { FileIcon, FolderIcon } from "@implementjs/lucide";

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

function TreeRow(entry: TreeEntry, depth: number, active: Signal<string>): Mountable[] {
	const indent = { paddingLeft: `${depth * 12 + 8}px` };
	if (entry.path === null) {
		return [
			Div(
				{ class: "flex items-center gap-1.5 py-1 pr-2 text-foreground/50", style: indent },
				FolderIcon({ class: "size-3.5 shrink-0" }),
				Span({ class: "truncate text-xs" }, entry.name),
			),
			...entry.children.flatMap((child) => TreeRow(child, depth + 1, active)),
		];
	}
	const path = entry.path;
	return [
		Button(
			{
				type: "button",
				class: derived([active], (current) => [
					"flex w-full items-center gap-1.5 py-1 pr-2 text-left",
					current === path
						? "bg-foreground/10 text-foreground"
						: "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
				]),
				style: indent,
				"aria-current": derived([active], (current) => (current === path ? "true" : undefined)),
				onClick: () => active.set(path),
			},
			FileIcon({ class: "size-3.5 shrink-0" }),
			Span({ class: "truncate font-mono text-xs" }, entry.name),
		),
	];
}

/** The lesson's files as a fixed tree; clicking a file opens it in the editor. */
export function FileTree(paths: readonly string[], active: Signal<string>): Mountable {
	const entries = buildTree(paths);
	return Div(
		{
			class: "w-44 shrink-0 overflow-y-auto border-r border-border py-2 lg:w-40 xl:w-44 2xl:w-48",
		},
		...entries.flatMap((entry) => TreeRow(entry, 0, active)),
	);
}
