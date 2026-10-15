---
title: Trace
description: One row for an agent's reasoning, tool calls, sources, and plan.
section: Components
---

<div data-demo="trace" data-demo-description="An agent's run as five lines: a search with a result count, a file read, a failed install that expands to a red code block with the pnpm error, an edit with a +12 −4 diff stat, and a re-run of the install, still running, its title shimmering."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/trace
```

It installs `@implementjs/lucide` for the chevron on an expanding row.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/trace.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="trace"></div>

<div data-tabs-end></div>

Then add [the shimmer](#shimmer) to your stylesheet.

## Usage

A `Trace` is a list of `TraceLine`s, and a line is an icon, a title, and optionally a description. That one row covers everything an agent shows while it works: a thought, a search, a command, a file it read or edited, a step in its plan.

```ts
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/lib/components/ui/trace";

Trace(TraceLine(TraceIcon(SearchIcon()), TraceTitle("Searched for minimumReleaseAge")));
```

`TraceLine` is always the line. To make it do something, wrap it in the thing that does it: a `TraceCollapsible` to expand it, an `A` to link out, a dialog, drawer, or popover trigger to open one. A wrapper that is a direct child of `Trace` takes the line's footprint and its focus ring, so the line inside it still reads as text.

```text
Trace
├── TraceLine
│   ├── TraceIcon
│   ├── TraceTitle
│   └── TraceDescription
└── TraceCollapsible
    ├── TraceCollapsibleTrigger
    │   └── TraceLine
    └── TraceCollapsibleContent
```

## Status

`status` says where a step stands. Leave it unset for work that is done.

<div data-demo="trace-status" data-demo-description="Four steps of a build: a finished install with a check, a failed lint in red, a build still running with a spinning loader and a shimmering title, and a test run not started yet, dimmed."></div>

| Status      | Use for                                                               |
| ----------- | --------------------------------------------------------------------- |
| none        | Work that is done: "Ran pnpm install".                                |
| `"error"`   | Work that failed. Say so in the title: "Failed to run pnpm lint".     |
| `"running"` | Work in progress, in the present tense: "Running pnpm build".         |
| `"pending"` | Work that has not started, such as a step of a plan: "Run pnpm test". |

It takes a readable, so a step can move along as the work does without rebuilding the line:

```ts
const status = signal<TraceStatus | undefined>("running");

TraceLine({ status }, TraceIcon(TerminalIcon()), TraceTitle("pnpm build"));

// later
status.set(undefined);
```

## Description

A `TraceDescription` after the title holds the aside: a duration, a count, a diff stat. It does not shrink, so a long title truncates before it does.

```ts
TraceLine(
	TraceIcon(FilePenIcon()),
	TraceTitle("Edited src/lib/components/settings/notification-preferences-form.ts"),
	TraceDescription({ class: "font-mono" }, "+48 −12"),
);
```

## Expanding a step

Wrap the line in a `TraceCollapsibleTrigger`, and put the detail in a `TraceCollapsibleContent` beside it. The trigger adds a chevron after the line that turns while the step is open. A small [code block](/ui/code-block) is the usual detail for a command:

```ts
TraceCollapsible(
	TraceCollapsibleTrigger(TraceLine(TraceIcon(TerminalIcon()), TraceTitle("Ran node --version"))),
	TraceCollapsibleContent(
		CodeBlock({ size: "sm" }, CodeBlockContent({ wrap: true }, "$ node --version\nv24.18.0")),
	),
);
```

Steps start closed. `TraceCollapsible` is the [Collapsible primitive](/primitives/docs/collapsible) underneath, so `open` takes a signal to start one open or drive it from outside, and `onOpenChange` hears about every change. The content slides with the `collapsible-down` / `collapsible-up` keyframes from the [introduction](/ui).

Steps nest: a `TraceCollapsibleContent` can hold another `Trace`, so a summary expands into its steps and a step into its output.

## Shimmer

A running line's title shimmers: a highlight sweeps across the text, built on `currentColor` so it suits whatever color the line already is. It is a Tailwind utility rather than a class the component carries, so paste it into your stylesheet beside the rest. Without it, a running line just reads as plain text.

```css
/* shimmer: a highlight that sweeps across text, for work in flight — the title
   of a running trace line. Built on currentColor, so it takes on whatever
   color the text already is. Ported from shadcn's `shadcn/tailwind.css`. */
@property --shimmer-image {
	syntax: "*";
	inherits: false;
}
@property --shimmer-text-fill {
	syntax: "*";
	inherits: false;
}

@theme inline {
	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: 0 0;
		}
	}
}

@utility shimmer {
	--_spread: var(--shimmer-spread, calc(3ch + 40px));
	--_base: currentColor;
	--_highlight: var(--shimmer-color, oklch(from currentColor l c h / calc(alpha* 0.2)));

	background-image: var(
		--shimmer-image,
		linear-gradient(
			110deg,
			var(--_base) calc(50% - var(--_spread)),
			color-mix(in oklch, var(--_highlight), var(--_base) 50%) calc(50% - var(--_spread) * 0.5),
			var(--_highlight) 50%,
			color-mix(in oklch, var(--_highlight), var(--_base) 50%) calc(50% + var(--_spread) * 0.5),
			var(--_base) calc(50% + var(--_spread))
		)
	);
	background-repeat: no-repeat;
	background-size: calc(200% + var(--_spread) * 2) 100%;
	background-position: 0 0;
	background-clip: text;
	-webkit-text-fill-color: var(--shimmer-text-fill, transparent);
	animation: shimmer var(--shimmer-duration, 2s) linear infinite;

	@variant dark {
		--_highlight: var(
			--shimmer-color,
			oklch(from currentColor max(0.8, calc(l + 0.4)) c h / calc(alpha + 0.4))
		);
	}

	&:where([dir="rtl"], [dir="rtl"] *) {
		animation-direction: reverse;
	}
}

/* Turns a shimmer off and leaves the text plain. */
@utility shimmer-none {
	--shimmer-image: none;
	--shimmer-text-fill: currentColor;
	animation: none;
}
```

The shimmer stops for a reader who prefers reduced motion; the title still says what is happening.

## Accessibility

- `TraceIcon` is `aria-hidden`. The title says what the step is, so the icon adds nothing a screen reader should read.
- An expanding step is a real button with `aria-expanded` and `aria-controls`, from the Collapsible primitive.
- Say the status in the title as well as with it — "Failed to run pnpm lint", not just a red line — so it does not rest on color alone.

## API Reference

<div data-api="ui-trace"></div>
