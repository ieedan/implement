import {
	Button,
	derived,
	Div,
	ForEach,
	If,
	ImplementDocument,
	ImplementLifecycle,
	Kbd,
	Mark,
	navigateTo,
	signal,
	Span,
	type Mountable,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { ArrowRightIcon, SearchIcon, XIcon } from "@implementjs/lucide";
import {
	DialogClose as DialogClosePrimitive,
	DialogTrigger as DialogTriggerPrimitive,
} from "@implementjs/primitives";
import { copyText } from "@/lib/copy-text";
import {
	prepareSearchIndex,
	searchPages,
	type HighlightPart,
	type IndexedArea,
	type SearchArea,
	type SearchIndex,
	type SearchPage,
	type SearchResult,
} from "@/lib/search";
import {
	ResponsiveDialog,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogTitle,
} from "../ui/responsive-dialog";
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

const SEARCH_INDEX_URL = "/search.json";

/**
 * The prebuilt index, fetched the first time the palette opens.
 *
 * Module scope rather than component state so it survives the header
 * remounting across sections — the corpus is downloaded once per document, not
 * once per visit to the palette. It stays null on the server: nothing calls
 * {@link loadIndex} outside a dialog the reader opened.
 */
const index = signal<SearchArea[] | null>(null);
const indexFailed = signal(false);
/** Non-null while a fetch is in flight or has succeeded; cleared on failure. */
let indexRequest: Promise<void> | null = null;

function isIndexedArea(value: unknown): value is IndexedArea {
	return (
		typeof value === "object" &&
		value !== null &&
		"key" in value &&
		typeof value.key === "string" &&
		"label" in value &&
		typeof value.label === "string" &&
		"markdown" in value &&
		typeof value.markdown === "boolean" &&
		"pages" in value &&
		Array.isArray(value.pages)
	);
}

/**
 * The index is a file rather than a module, so its shape is checked rather
 * than assumed. The case worth guarding is a host whose SPA fallback answers
 * an unknown path with the app shell and a 200 — the palette should say search
 * is unavailable, not throw on the first keystroke.
 */
function asSearchIndex(payload: unknown): SearchIndex {
	const areas = Array.isArray(payload) ? payload.filter(isIndexedArea) : [];
	if (areas.length === 0) throw new Error(`${SEARCH_INDEX_URL} held no searchable areas`);
	return areas;
}

function loadIndex(): void {
	indexRequest ??= fetch(SEARCH_INDEX_URL)
		.then(async (response) => {
			if (!response.ok) throw new Error(`${SEARCH_INDEX_URL} responded ${response.status}`);
			index.set(prepareSearchIndex(asSearchIndex(await response.json())));
			indexFailed.set(false);
		})
		.catch((error: unknown) => {
			// clearing the handle lets the next open try again — a search that
			// failed once because the network blipped should not stay broken
			indexRequest = null;
			indexFailed.set(true);
			console.error("could not load the docs search index", error);
		});
}

/** A result plus the area it came from, which decides the `.md` action. */
type Hit = { area: SearchArea; result: SearchResult };

/**
 * Rows are rebuilt rather than patched when their text changes, so the key
 * carries the highlighting: the same page under a different query is a
 * different row.
 */
function partsKey(parts: HighlightPart[]): string {
	return parts.map((part) => (part.match ? `[${part.text}]` : part.text)).join("");
}

function rowKey(result: SearchResult): string {
	return `${result.href} ${partsKey(result.title)} ${partsKey(result.detail)}`;
}

/** FNV-1a, for a short stand-in for the row's text inside an item value. */
function fold(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

/**
 * The item value Command tracks a row by. Permalinks repeat across areas
 * (`/docs` and `/kit` both have an index), and the row's text is folded in
 * because a replaced row unregisters its value *after* its replacement
 * registers — sharing one would leave the surviving row unaccounted for, and
 * the palette claiming it found nothing.
 */
function hitValue(area: SearchArea, result: SearchResult): string {
	return `${area.key} ${result.href} ${fold(rowKey(result))}`;
}

/** The look of a key cap: a small bordered chip. */
const kbdClass =
	"flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground select-none";
/**
 * A key cap that is only naming a key. Every one of these sits inside something
 * clickable — the trigger, the actions menu — so it must not swallow the click.
 */
const kbdHintClass = `pointer-events-none ${kbdClass}`;

const SEARCH_INPUT_ID = "docs-search-input";

async function copyMarkdown(page: SearchPage) {
	const response = await fetch(`${page.permalink}.md`);
	if (!response.ok) return;
	await copyText(await response.text());
}

function focusSearchInput() {
	queueMicrotask(() => document.getElementById(SEARCH_INPUT_ID)?.focus());
}

/** How long to keep trying for an anchor that is not in reach yet. */
const SCROLL_TIMEOUT = 600;
const SCROLL_RETRY = 20;

/**
 * Scrolls to a heading the palette just navigated to. The destination page
 * renders a tick later and the dialog holds the body's scroll lock until its
 * exit transition ends, so one attempt is not enough — keep trying until the
 * heading is actually on screen. Timers rather than frames: a background tab
 * runs no frames at all.
 */
function scrollToAnchor(id: string) {
	const deadline = Date.now() + SCROLL_TIMEOUT;
	const attempt = () => {
		const target = document.getElementById(id);
		if (target) {
			target.scrollIntoView();
			const { top } = target.getBoundingClientRect();
			if (top >= 0 && top < window.innerHeight) return;
		}
		if (Date.now() < deadline) setTimeout(attempt, SCROLL_RETRY);
	};
	attempt();
}

function AreaChip(area: Signal<string>, key: string, label: string): Mountable {
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

/** A result's text with the runs the query hit marked, so the hit is visible. */
function Highlighted(parts: HighlightPart[], className: string): Mountable {
	return Span(
		{ class: className },
		...parts
			.filter((part) => part.text !== "")
			.map((part) =>
				part.match
					? Mark(
							{ class: "rounded-[3px] bg-foreground/20 px-0.5 font-medium text-foreground" },
							part.text,
						)
					: part.text,
			),
	);
}

function ResultItem(area: SearchArea, result: SearchResult, goTo: (result: SearchResult) => void) {
	return CommandLinkItem(
		{
			value: hitValue(area, result),
			href: result.href,
			class:
				"group/search-item mx-2 my-1 flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 no-underline data-selected:bg-accent",
			onClick(event) {
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				if (event.button !== 0) return;
				event.preventDefault();
				goTo(result);
			},
		},
		Div(
			{ class: "flex min-w-0 flex-col" },
			Span(
				{ class: "truncate text-sm text-foreground" },
				// a section hit names the page it sits in ahead of its own heading
				...(result.heading === null
					? []
					: [
							Span({ class: "text-muted-foreground" }, result.page.title),
							Span({ class: "text-muted-foreground/60" }, " / "),
						]),
				Highlighted(result.title, ""),
			),
			Highlighted(result.detail, "truncate text-sm text-muted-foreground"),
		),
		ArrowRightIcon({
			class: "ml-auto size-4 shrink-0 opacity-0 group-data-selected/search-item:opacity-100",
			"aria-hidden": true,
		}),
	);
}

/**
 * The docs search palette: a Cmd+K dialog over the Command primitive that
 * searches every docs page by title, description, and page content. A hit in
 * the body of a page becomes its own result, landing on the heading it sits
 * under and carrying a snippet with the match highlighted. The chips narrow
 * the search to one part of the docs, results group by the part they cover,
 * and Cmd+K again opens an actions menu for the highlighted result.
 */
/** One area's results, under its package name. */
function AreaGroup(
	entry: SearchArea,
	results: Readable<Map<string, SearchResult[]>>,
	goTo: (result: SearchResult) => void,
): Mountable {
	return CommandGroup(
		{ value: entry.label },
		// package names are cased as published, not upper-cased like the base heading
		CommandGroupHeading({ class: "font-mono [text-transform:none]!" }, entry.label),
		CommandGroupItems(
			{ class: "p-0 py-1" },
			ForEach(
				derived([results], (byArea) => byArea.get(entry.key) ?? []),
				rowKey,
				// the key covers every word the row renders, so a row
				// never has to update itself in place
				(result) => ResultItem(entry, result.get(), goTo),
			),
		),
	);
}

export function DocsSearch(): Mountable {
	const open = signal(false);
	const actionsOpen = signal(false);
	const search = signal("");
	const value = signal("");
	const area = signal<string>("all");

	/** The areas the fetched index names, or none while it is still loading. */
	const areas = derived([index], (loaded) => loaded ?? []);

	/**
	 * What the palette says when it has no rows: three different situations
	 * look alike from the Command primitive's side, and "No results found."
	 * under a query that was never run reads as a broken search.
	 */
	const emptyText = derived([index, indexFailed], (loaded, failed) => {
		if (failed) return "Search is unavailable right now.";
		if (loaded === null) return "Loading search…";
		return "No results found.";
	});

	// Command's own filter scores an item's value; these results are matched and
	// ranked whole pages at a time, so `shouldFilter` is off below and the
	// ranking happens here.
	const results = derived([search, areas], (query, loaded) => {
		const byArea = new Map<string, SearchResult[]>();
		for (const entry of loaded) byArea.set(entry.key, searchPages(entry.pages, query));
		return byArea;
	});

	/**
	 * Which areas to render, best match first. Ranking inside an area is the
	 * search module's job; without this the areas themselves stayed in
	 * declaration order, so an exact title match in a later package sat below
	 * every passing mention in an earlier one — "sidebar" led with the router
	 * page rather than the component.
	 *
	 * An empty query scores every page 0 and `sort` is stable, so the resting
	 * list keeps its declared order.
	 */
	const ranked = derived([results, area, areas], (byArea, current, loaded) => {
		const visible = loaded
			.filter(
				(entry) =>
					(current === "all" || current === entry.key) && (byArea.get(entry.key)?.length ?? 0) > 0,
			)
			.map((entry) => ({ entry, best: byArea.get(entry.key)?.[0]?.score ?? 0 }));
		visible.sort((a, b) => b.best - a.best);
		return visible.map(({ entry }) => entry);
	});

	const hits = derived([results, area, areas], (byArea, current, loaded) => {
		const map = new Map<string, Hit>();
		for (const entry of loaded) {
			if (current !== "all" && current !== entry.key) continue;
			for (const result of byArea.get(entry.key) ?? []) {
				map.set(hitValue(entry, result), { area: entry, result });
			}
		}
		return map;
	});

	const selected = derived([value, hits], (current, map) => map.get(current) ?? null);

	const goTo = (result: SearchResult) => {
		actionsOpen.set(false);
		open.set(false);
		navigateTo(result.href);
		// navigateTo puts the page back at the top; the router leaves the
		// fragment to whoever asked for it
		const hash = result.href.indexOf("#");
		if (hash !== -1) scrollToAnchor(result.href.slice(hash + 1));
	};

	return ResponsiveDialog(
		{ open },
		// ⌘K / Ctrl+K opens the palette; pressed again it opens the actions
		// menu for the highlighted result.
		ImplementDocument({
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
		ImplementLifecycle({
			onMount: () => {
				const unsubOpen = open.onChange((isOpen) => {
					if (isOpen) {
						// after the modal's own focus pass, move focus into the search box
						focusSearchInput();
						// first open pays for the index; every later one is free
						loadIndex();
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
			Kbd({ class: [kbdHintClass, "max-sm:hidden"] }, "⌘K"),
		),
		// A palette above the page on a desktop, a drawer up from the bottom edge
		// on a phone — where the panel is tall enough to keep the input above the
		// keyboard, and a swipe puts it away. Both shapes portal to the body: the
		// site header is a `z-10` stacking context, so an overlay left inside it
		// would paint under the page's own dialogs, and `z-60` puts search above
		// those too.
		ResponsiveDialogContent(
			{
				showCloseButton: false,
				overlay: { class: "z-60" },
				class: [
					"z-60 gap-0 overflow-hidden p-0",
					"md:top-[12%] md:max-w-2xl md:translate-y-0 md:rounded-xl",
					"max-md:h-[85dvh]",
				],
			},
			ResponsiveDialogTitle({ class: "sr-only" }, "Search docs"),
			ResponsiveDialogDescription(
				{ class: "sr-only" },
				"Search every docs page by title, description, and page content.",
			),
			Command(
				{
					label: "Search docs",
					value,
					search,
					// results are matched, ranked, and highlighted above
					shouldFilter: false,
					// ctrl+k opens the actions menu instead of moving the highlight
					vimBindings: false,
					class: "bg-transparent max-md:min-h-0 max-md:flex-1",
				},
				Div(
					{ class: "flex items-center gap-2 px-3 pt-3 pb-1" },
					// the filters scroll sideways rather than wrap; esc stays put beside them
					Div(
						{ class: "no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" },
						AreaChip(area, "all", "All"),
						// the areas are whatever the index names, so the filters
						// appear with it rather than being declared twice
						ForEach(
							areas,
							(entry) => entry.key,
							// keyed on the area, so the chip's identity is pinned
							(entry) => AreaChip(area, entry.get().key, entry.get().label),
						),
					),
					// the chip named the key that closes the palette without being able to
					// close it, which on a phone named a key that is not there either
					DialogClosePrimitive(
						{
							class: [
								kbdClass,
								"shrink-0 cursor-pointer transition-colors hover:bg-accent hover:text-foreground",
								// a key cap is the right size for something a mouse points at
								// and a poor one for a thumb, so the ✕ gets a bigger box
								"max-md:h-7 max-md:min-w-7",
							],
							"aria-label": "Close search",
						},
						Span({ "aria-hidden": true, class: "max-md:hidden" }, "esc"),
						XIcon({ class: "size-3.5 md:hidden", "aria-hidden": true }),
					),
				),
				CommandInput({ id: SEARCH_INPUT_ID, placeholder: "Search docs..." }),
				CommandList(
					// fixed height in the dialog; in the drawer it takes what the panel
					// has left, so the input stays put and the results scroll under it
					{
						class:
							"h-80 max-h-[50dvh] max-md:h-auto max-md:max-h-none max-md:min-h-0 max-md:flex-1",
					},
					CommandViewport(
						{},
						CommandEmpty({}, emptyText),
						ForEach(
							ranked,
							(entry) => entry.key,
							// keyed on the area, so the row's identity is pinned and
							// reading it once here is safe
							(entry) => AreaGroup(entry.get(), results, goTo),
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
							selected.bind((hit) =>
								hit === null ? "Go to page" : `Go to ${hit.result.page.title}`,
							),
						),
						Kbd({ class: [kbdHintClass, "max-md:hidden"] }, "⏎"),
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
							Kbd({ class: [kbdHintClass, "max-md:hidden"] }, "⌘K"),
						),
						DropdownMenuContent(
							{ side: "top", align: "end", class: "w-64" },
							DropdownMenuItem(
								{
									onSelect: () => {
										const hit = selected.get();
										if (hit) goTo(hit.result);
									},
								},
								Span(
									{ class: "truncate" },
									selected.bind((hit) =>
										hit === null ? "Go to page" : `Go to ${hit.result.page.title}`,
									),
								),
								ArrowRightIcon({
									class: "ml-auto size-4 text-muted-foreground",
									"aria-hidden": true,
								}),
							),
							// lessons have no markdown twin, so the action drops out for them
							If(derived([selected], (hit) => hit?.area.markdown === true)).Then(
								DropdownMenuItem(
									{
										onSelect: () => {
											const hit = selected.get();
											if (hit) void copyMarkdown(hit.result.page);
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
	);
}
