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
import { ArrowRightIcon, FileTextIcon, SearchIcon } from "@implementjs/lucide";
import {
	Dialog as DialogPrimitive,
	DialogContent as DialogContentPrimitive,
	DialogDescription as DialogDescriptionPrimitive,
	DialogOverlay as DialogOverlayPrimitive,
	DialogTitle as DialogTitlePrimitive,
	DialogTrigger as DialogTriggerPrimitive,
} from "@implementjs/primitives";
import { kitPages, lucidePages, pages, primitivePages } from "@/lib/content";
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

/** The shape all four content collections share. */
type DocPage = { title: string; description: string; permalink: string };

type AreaKey = "lib" | "kit" | "primitives" | "lucide";

type Area = { key: AreaKey; label: string; pages: DocPage[] };

const areas: Area[] = [
	{ key: "lib", label: "Lib", pages },
	{ key: "kit", label: "Kit", pages: kitPages },
	{ key: "primitives", label: "Primitives", pages: primitivePages },
	{ key: "lucide", label: "Lucide", pages: lucidePages },
];

/** Titles repeat across areas ("Introduction"), so items key on area + title. */
function entryValue(area: Area, page: DocPage): string {
	return `${area.label} ${page.title}`;
}

const entryByValue = new Map<string, DocPage>();
for (const area of areas) {
	for (const page of area.pages) entryByValue.set(entryValue(area, page), page);
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
				"rounded-md border px-3 py-1 text-xs font-medium transition-colors",
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
		DialogOverlayPrimitive({
			class: [
				"fixed inset-0 z-50 bg-black/50",
				"transition-[opacity,display] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] transition-discrete motion-reduce:transition-none",
				"data-[state=open]:block data-[state=open]:opacity-100",
				"data-[state=closed]:pointer-events-none data-[state=closed]:hidden data-[state=closed]:opacity-0",
				"starting:data-[state=open]:opacity-0",
			],
		}),
		DialogContentPrimitive(
			{
				class: [
					"fixed top-[12%] left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border bg-background text-foreground shadow-lg outline-none",
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
					AreaChip(area, "all", "All"),
					...areas.map((entry) => AreaChip(area, entry.key, entry.label)),
					Kbd({ class: [kbdClass, "ml-auto"] }, "esc"),
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
									CommandGroupHeading({}, entry.label),
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
							selected.bind((entry) => (entry === null ? "Go to page" : `Go to ${entry.title}`)),
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
										const page = selected.get();
										if (page) goTo(page);
									},
								},
								Span(
									{ class: "truncate" },
									selected.bind((entry) =>
										entry === null ? "Go to page" : `Go to ${entry.title}`,
									),
								),
								ArrowRightIcon({
									class: "ml-auto size-4 text-muted-foreground",
									"aria-hidden": true,
								}),
							),
							DropdownMenuItem(
								{
									onSelect: () => {
										const page = selected.get();
										if (page) void copyMarkdown(page);
									},
								},
								"Copy Markdown",
								FileTextIcon({
									class: "ml-auto size-4 text-muted-foreground",
									"aria-hidden": true,
								}),
							),
						),
					),
				),
			),
		),
	);
}
