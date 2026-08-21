---
title: Accordion
description: Expand and collapse sections of content, one at a time or several at once.
section: Components
---

<div data-demo="accordion" data-demo-description="A three-item FAQ accordion (type multiple) about implement; clicking a question expands its answer, several can stay open."></div>

An accordion is a stack of items that open and close. `Accordion` is the root, `AccordionItem` is one section, `AccordionTrigger` is the control that toggles it, and `AccordionContent` is the body.

```ts
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@implementjs/primitives";

Accordion(
	AccordionItem(
		{ value: "what" },
		AccordionTrigger("What is implement?"),
		AccordionContent("A signal-based UI framework with no compiler."),
	),
	AccordionItem(
		{ value: "why" },
		AccordionTrigger("Why no compiler?"),
		AccordionContent("Your app is plain TypeScript that builds real DOM nodes."),
	),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div` or `Button`.

## Single or multiple

`type` defaults to `"single"`: opening one item closes the others. Pass `"multiple"` to let several items stay open at once.

```ts
Accordion(
	{ type: "multiple" },
	AccordionItem({ value: "a" }, AccordionTrigger("A"), AccordionContent("First")),
	AccordionItem({ value: "b" }, AccordionTrigger("B"), AccordionContent("Second")),
);
```

Every item needs a stable `value`. That string is what the root tracks as its open state, so it also has to be unique within the accordion.

## Controlling the open items

Pass a signal as `value` to own the open state from outside. A `"single"` accordion takes a `Signal<string | null>`, a `"multiple"` accordion a `Signal<string[]>`:

```ts
import { signal } from "@implementjs/core";

const open = signal<string | null>("what");

Accordion(
	{ value: open },
	AccordionItem({ value: "what" }, AccordionTrigger("A"), AccordionContent("First")),
	AccordionItem({ value: "why" }, AccordionTrigger("B"), AccordionContent("Second")),
);

open.set("why"); // opens "why", closing "what"
```

## The trigger and the content

`AccordionTrigger` renders a `Button`. Clicking it toggles the item. `AccordionContent` is a `Div` that sets the `hidden` attribute while the item is closed, so the body is out of the accessibility tree and not shown.

If you want find-in-page to still search closed sections, pass `hiddenUntilFound`. Closed content then uses `hidden="until-found"` instead of the boolean `hidden` attribute, and the browser can reveal a match.

```ts
AccordionContent({ hiddenUntilFound: true }, LongAnswer());
```

## Headings

Wrap the trigger in `AccordionHeader` when the item title should be a heading. It renders a `Div` with `role="heading"` and `aria-level` (3 by default):

```ts
AccordionItem(
	{ value: "what" },
	AccordionHeader({ level: 3 }, AccordionTrigger("What is implement?")),
	AccordionContent("..."),
);
```

## Styling

Every part sets a `data-accordion-*` attribute so you can target it in CSS, and items, triggers, headers, and content expose `data-state` as `"open"` or `"closed"`:

```ts
AccordionTrigger(
	{ class: "flex w-full items-center justify-between py-2 font-medium" },
	"What is implement?",
);

AccordionContent(
	{ class: "pb-4 text-sm text-foreground/70" },
	"A signal-based UI framework with no compiler.",
);
```

The `hidden` attribute already hides closed content. `data-state` is there for transitions, chevrons, and anything else that should react to open versus closed without you threading a signal through.

## Animating open and close

`AccordionContent` measures itself whenever it opens or closes and exposes the result as `--ip-accordion-content-height` and `--ip-accordion-content-width` on the element, so keyframes can animate between zero and the natural size. When an item closes, the content keeps rendering until any animation running on it finishes — only then does the `hidden` attribute go on.

```css
[data-accordion-content] {
	overflow: hidden;
}

[data-accordion-content][data-state="open"] {
	animation: accordion-down 0.2s ease-out;
}

[data-accordion-content][data-state="closed"] {
	animation: accordion-up 0.2s ease-out;
}

@keyframes accordion-down {
	from {
		height: 0;
	}
	to {
		height: var(--ip-accordion-content-height);
	}
}

@keyframes accordion-up {
	from {
		height: var(--ip-accordion-content-height);
	}
	to {
		height: 0;
	}
}
```

Content that is open on first render does not replay its open animation on page load.

## API Reference

<div data-api="accordion"></div>
