---
title: Collapsible
description: Expand and collapse a region of content.
section: Components
---

<div data-demo="collapsible"></div>

A collapsible is a single region that opens and closes. `Collapsible` is the root, `CollapsibleTrigger` is the control that toggles it, and `CollapsibleContent` is the body. Use it when one piece of UI should hide and show. For a stack of sections, use [Accordion](/primitives/docs/accordion).

```ts
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@implementjs/primitives";

Collapsible(
	{},
	CollapsibleTrigger({}, "Show more"),
	CollapsibleContent({}, "The rest of the details live here."),
);
```

Each part takes a props object first (even if it is empty) and then children, the same shape as the [element factories](/docs/elements). Extra props are forwarded onto the underlying `Div` or `Button`.

## Open state

`Collapsible` owns whether the body is open. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const open = signal(false);

Collapsible(
	{ open },
	CollapsibleTrigger({}, "Show more"),
	CollapsibleContent({}, "The rest of the details live here."),
);

Button({ onClick: () => open.set(true) }, "Expand");
```

## The trigger and the content

`CollapsibleTrigger` renders a `Button`. Clicking it toggles the region. `CollapsibleContent` is a `Div` that sets the `hidden` attribute while closed, so the body is out of the accessibility tree and not shown.

If you want find-in-page to still search closed content, pass `hiddenUntilFound`. Closed content then uses `hidden="until-found"` instead of the boolean `hidden` attribute, and the browser can reveal a match.

```ts
CollapsibleContent({ hiddenUntilFound: true }, LongAnswer());
```

The trigger sets `aria-expanded` from the open state and `aria-controls` to the content's `id`, so assistive technology can associate the two.

## Styling

Every part sets a `data-collapsible-*` attribute so you can target it in CSS, and the root, trigger, and content expose `data-state` as `"open"` or `"closed"`:

```ts
CollapsibleTrigger({ class: "inline-flex items-center gap-2 text-sm font-medium" }, "Show more");

CollapsibleContent(
	{ class: "text-sm text-foreground/70 data-[state=closed]:animate-collapse" },
	"The rest of the details live here.",
);
```

The `hidden` attribute already hides closed content. `data-state` is there for transitions, chevrons, and anything else that should react to open versus closed without you threading a signal through.

## API Reference

<div data-api="collapsible"></div>
