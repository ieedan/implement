import {
	Button,
	derived,
	Div,
	If,
	Implement,
	Kbd,
	navigateTo,
	signal,
	Span,
	type Mountable,
	type Signal,
} from "@implementjs/core";
import { ArrowRightIcon, SearchIcon } from "@implementjs/lucide";
import {
	Dialog as DialogPrimitive,
	DialogContent as DialogContentPrimitive,
	DialogDescription as DialogDescriptionPrimitive,
	DialogOverlay as DialogOverlayPrimitive,
	DialogPortal as DialogPortalPrimitive,
	DialogTitle as DialogTitlePrimitive,
	DialogTrigger as DialogTriggerPrimitive,
} from "@implementjs/primitives";
import {
	formishPages,
	kitPages,
	lucidePages,
	pages,
	primitivePages,
	tutorials,
} from "@/lib/content";
import { copyText } from "@/lib/copy-text";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandGroupHeading,
	CommandGroupItems,
	CommandInput,
	CommandLinkItem,
	CommandList,
	CommandViewport,
} from "../ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { MarkdownIcon } from "./brand-icons";

/** The shape every content collection shares. */
type DocPage = { title: string; description: string; permalink: string };

type AreaKey = "lib" | "kit" | "primitives" | "formish" | "lucide" | "tutorial";

type Area = {
	key: AreaKey;
	label: string;
	pages: DocPage[];
	/** Whether kit serves a `.md` twin next to these pages (lessons have none). */
	markdown: boolean;
};

const areas: Area[] = [
	{ key: "lib", label: "@implementjs/core", pages, markdown: true },
	{ key: "kit", label: "@implementjs/kit", pages: kitPages, markdown: true },
	{
		key: "primitives",
		label: "@implementjs/primitives",
		pages: primitivePages,
		markdown: true,
	},
	{ key: "formish", label: "@implementjs/formish", pages: formishPages, markdown: true },
	{ key: "lucide", label: "@implementjs/lucide", pages: lucidePages, markdown: true },
	{ key: "tutorial", label: "Tutorial", pages: tutorials, markdown: false },
];

/** Titles repeat across areas ("Introduction"), so items key on area + title. */
function entryValue(area: Area, page: DocPage): string {
	return `${area.key} ${page.title}`;
}

type Entry = { page: DocPage; markdown: boolean };

const entryByValue = new Map<string, Entry>();
for (const area of areas) {
	for (const page of area.pages) {
		entryByValue.set(entryValue(area, page), { page, markdown: area.markdown });
	}
}

const kbdClass =
	"pointer-events-none flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground select-none";

const SEARCH_INPUT_ID = "docs-search-input";

async function copyMarkdown(page: DocPage) {
	const response = await fetch(`${page.permalink}.md`);
	if (!response.ok) return;
	await copyText(await response.text());
}

function focusSearchInput() {
	queueMicrotask(() => document.getElementById(SEARCH_INPUT_ID)?.focus());
}

function AreaChip(area: Signal<"all" | AreaKey>, key: "all" | AreaKey, label: string): Mountable {
	return Button(
		{
			type: "button",
			class: derived([area], (current) => [
				"shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
				// package names read as code; "All" and "Tutorial" are prose
				label.startsWith("@") ? "font-mono" : "",
				current === key
					? "border-foreground/25 bg-accent text-foreground"
					: "border-border text-muted-foreground hover:text-foreground",
			]),
			"aria-pressed": derived([area], (current) => current === key),
			onClick: () => {
				area.set(key);
				focusSearchInput();
			},
		},
		label,
	);
}

function ResultItem(page: DocPage, value: string, goTo: (page: DocPage) => void): Mountable {
	return CommandLinkItem(
		{
			value,
			keywords: [page.title, page.description],
			href: page.permalink,
			class:
				"group/search-item mx-2 my-1 flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 no-underline data-selected:bg-accent",
			onClick(event) {
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				if (event.button !== 0) return;
				event.preventDefault();
				goTo(page);
			},
		},
		Div(
			{ class: "flex min-w-0 flex-col" },
			Span({ class: "truncate text-sm text-foreground" }, page.title),
			Span({ class: "truncate text-sm text-muted-foreground" }, page.description),
		),
		ArrowRightIcon({
			class: "ml-auto size-4 shrink-0 opacity-0 group-data-selected/search-item:opacity-100",
			"aria-hidden": true,
		}),
	);
}

/**
 * The docs search palette: a ⌘K dialog over the Command primitive that
 * searches every docs page by title and description. The chips narrow the
 * search to one part of the docs, results group by the part they cover, and
 * ⌘K again opens an actions menu for the highlighted page.
 */
export function DocsSearch(): Mountable {
	const open = signal(false);
	const actionsOpen = signal(false);
	const search = signal("");
	const value = signal("");
	const area = signal<"all" | AreaKey>("all");

	const selected = derived([value], (current) => entryByValue.get(current) ?? null);

	const goTo = (page: DocPage) => {
		actionsOpen.set(false);
		open.set(false);
		navigateTo(page.permalink);
	};

	return DialogPrimitive(
		{ open },
		// ⌘K / Ctrl+K opens the palette; pressed again it opens the actions
		// menu for the highlighted result.
		Implement.Document({
			onKeydown(e) {
				if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
					e.preventDefault();
					if (!open.get()) {
						open.set(true);
					} else if (selected.get() !== null || actionsOpen.get()) {
						actionsOpen.toggle();
					}
				}
			},
		}),
		Implement.Lifecycle({
			onMount: () => {
				const unsubOpen = open.onChange((isOpen) => {
					if (isOpen) {
						// after the modal's own focus pass, move focus into the search box
						focusSearchInput();
					} else {
						actionsOpen.set(false);
						search.set("");
					}
				});
				// the menu restores focus to its trigger; hand it back to the input
				const unsubActions = actionsOpen.onChange((isOpen) => {
					if (!isOpen && open.get()) focusSearchInput();
				});
				return () => {
					unsubOpen();
					unsubActions();
				};
			},
		}),
		DialogTriggerPrimitive(
			{
				class:
					"flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:w-56",
				"aria-label": "Search docs",
			},
			SearchIcon({ class: "size-4 shrink-0", "aria-hidden": true }),
			Span({ class: "flex-1 text-left max-sm:hidden" }, "Search docs..."),
			Kbd({ class: [kbdClass, "max-sm:hidden"] }, "⌘K"),
		),
		// portaled to the body: the site header is a `z-10` stacking context, so
		// an overlay left inside it paints under the page's own dialogs
		DialogPortalPrimitive(
			DialogOverlayPrimitive({
				class: [
					"fixed inset-0 z-60 bg-black/50",
					"transition-[opacity,display] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] transition-discrete motion-reduce:transition-none",
					"data-[state=open]:block data-[state=open]:opacity-100",
					"data-[state=closed]:pointer-events-none data-[state=closed]:hidden data-[state=closed]:opacity-0",
					"starting:data-[state=open]:opacity-0",
				],
			}),
			DialogContentPrimitive(
				{
					class: [
						"fixed top-[12%] left-1/2 z-60 w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border bg-background text-foreground shadow-lg outline-none",
						"transition-[opacity,scale,display] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] transition-discrete motion-reduce:transition-none",
						"data-[state=open]:block data-[state=open]:scale-100 data-[state=open]:opacity-100",
						"data-[state=closed]:pointer-events-none data-[state=closed]:hidden data-[state=closed]:scale-95 data-[state=closed]:opacity-0",
						"starting:data-[state=open]:opacity-0 starting:data-[state=open]:scale-95",
					],
				},
				DialogTitlePrimitive({ class: "sr-only" }, "Search docs"),
				DialogDescriptionPrimitive(
					{ class: "sr-only" },
					"Search every docs page by title and description.",
				),
				Command(
					{
						label: "Search docs",
						value,
						search,
						// ctrl+k opens the actions menu instead of moving the highlight
						vimBindings: false,
						class: "bg-transparent",
					},
					Div(
						{ class: "flex items-center gap-2 px-3 pt-3 pb-1" },
						// the filters scroll sideways rather than wrap; esc stays put beside them
						Div(
							{ class: "no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" },
							AreaChip(area, "all", "All"),
							...areas.map((entry) => AreaChip(area, entry.key, entry.label)),
						),
						Kbd({ class: [kbdClass, "shrink-0"] }, "esc"),
					),
					CommandInput({ id: SEARCH_INPUT_ID, placeholder: "Search docs..." }),
					CommandList(
						{ class: "h-80 max-h-[50dvh]" },
						CommandViewport(
							{},
							CommandEmpty({}, "No results found."),
							...areas.map((entry) =>
								If(derived([area], (current) => current === "all" || current === entry.key)).Then(
									CommandGroup(
										{ value: entry.label },
										// package names are cased as published, not upper-cased like the base heading
										CommandGroupHeading({ class: "font-mono [text-transform:none]!" }, entry.label),
										CommandGroupItems(
											{ class: "p-0 py-1" },
											...entry.pages.map((page) => ResultItem(page, entryValue(entry, page), goTo)),
										),
									),
								),
							),
						),
					),
					Div(
						{
							class:
								"flex items-center justify-end gap-3 border-t px-3 py-2 text-xs text-muted-foreground",
						},
						Div(
							{ class: "flex min-w-0 items-center gap-2" },
							Span(
								{ class: "truncate" },
								selected.bind((entry) =>
									entry === null ? "Go to page" : `Go to ${entry.page.title}`,
								),
							),
							Kbd({ class: kbdClass }, "⏎"),
						),
						Div({ class: "h-4 w-px bg-border", "aria-hidden": true }),
						DropdownMenu(
							{ open: actionsOpen, preventScroll: false },
							DropdownMenuTrigger(
								{
									variant: "ghost",
									size: "xs",
									class: "gap-2 text-xs text-muted-foreground hover:text-foreground",
								},
								"Actions",
								Kbd({ class: kbdClass }, "⌘K"),
							),
							DropdownMenuContent(
								{ side: "top", align: "end", class: "w-64" },
								DropdownMenuItem(
									{
										onSelect: () => {
											const entry = selected.get();
											if (entry) goTo(entry.page);
										},
									},
									Span(
										{ class: "truncate" },
										selected.bind((entry) =>
											entry === null ? "Go to page" : `Go to ${entry.page.title}`,
										),
									),
									ArrowRightIcon({
										class: "ml-auto size-4 text-muted-foreground",
										"aria-hidden": true,
									}),
								),
								// lessons have no markdown twin, so the action drops out for them
								If(derived([selected], (entry) => entry?.markdown === true)).Then(
									DropdownMenuItem(
										{
											onSelect: () => {
												const entry = selected.get();
												if (entry) void copyMarkdown(entry.page);
											},
										},
										"Copy Markdown",
										MarkdownIcon({
											class: "ml-auto size-4 text-muted-foreground",
											"aria-hidden": true,
										}),
									),
								),
							),
						),
					),
				),
			),
		),
	);
}
