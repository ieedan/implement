import {
	A,
	Details,
	Div,
	Implement,
	Li,
	Nav,
	signal,
	Span,
	Summary,
	Ul,
	derived,
	type Mountable,
	type Readable,
} from "@implementjs/core";
import type { TocEntry } from "@/lib/toc";
import { ChevronRightIcon } from "@implementjs/lucide";

function flatten(entries: TocEntry[]): TocEntry[] {
	return entries.flatMap((entry) => [entry, ...flatten(entry.items)]);
}

/**
 * Pixels from the viewport top a heading counts as "reached". Just past the
 * largest anchor scroll-margin (see app.css), so a jumped-to heading is always
 * the active one.
 */
const activeOffset = 112;

function TocList(entries: TocEntry[], active: Readable<string | null>, depth = 0): Mountable {
	return Ul(
		{ class: depth === 0 ? "space-y-2" : "mt-2 space-y-2 pl-3" },
		...entries.map((entry) =>
			Li(
				A(
					{
						href: entry.url,
						class: derived([active], (url) => [
							"block text-[13px] leading-snug transition-colors hover:text-foreground",
							url === entry.url ? "text-foreground" : "text-foreground/50",
						]),
					},
					entry.title,
				),
				...(entry.items.length ? [TocList(entry.items, active, depth + 1)] : []),
			),
		),
	);
}

/** Tracks which toc entry's heading was scrolled past last. */
function activeEntry(entries: TocEntry[]): { active: Readable<string | null>; spy: Mountable } {
	const active = signal<string | null>(null);
	const urls = flatten(entries).map((entry) => entry.url);

	const update = () => {
		let current: string | null = null;
		for (const url of urls) {
			const heading = document.getElementById(url.slice(1));
			if (heading == null) continue;
			if (heading.getBoundingClientRect().top > activeOffset) break;
			current = url;
		}
		active.set(current);
	};

	const spy = Div(
		Implement.Window({ onScroll: update, onResize: update }),
		Implement.Lifecycle({ onMount: () => update() }),
	);

	return { active, spy };
}

/**
 * Sticky "On this page" sidebar for wide viewports, highlighting the section
 * currently in view. Hidden below `xl` — pair with {@link TocDisclosure} there.
 */
export function TocSidebar(entries: TocEntry[]): Mountable {
	const { active, spy } = activeEntry(entries);

	return Nav(
		{
			"aria-label": "On this page",
			class:
				"sticky top-24 hidden max-h-[calc(100dvh-8rem)] w-52 shrink-0 self-start overflow-y-auto xl:block",
		},
		spy,
		Span(
			{ class: "text-[11px] font-medium uppercase tracking-wide text-foreground/40" },
			"On this page",
		),
		Div({ class: "mt-3" }, TocList(entries, active)),
	);
}

/** Collapsed "On this page" disclosure for narrow viewports. Hidden at `xl` and up. */
export function TocDisclosure(entries: TocEntry[]): Mountable {
	return Details(
		{ class: "group rounded-lg border border-border xl:hidden" },
		Summary(
			{
				class:
					"flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground/80 marker:content-none [&::-webkit-details-marker]:hidden",
			},
			ChevronRightIcon({
				class: "size-3.5 text-foreground/40 transition-transform group-open:rotate-90",
			}),
			"On this page",
		),
		Nav(
			{ "aria-label": "On this page", class: "border-t border-border px-4 py-3" },
			TocList(entries, signal(null)),
		),
	);
}
