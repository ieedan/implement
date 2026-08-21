---
title: Collapsible
description: Expand and collapse a region of content.
section: Components
---

<div data-demo="collapsible" data-demo-description="A “@ieedan starred 3 packages” header with a chevron toggle: one repo stays visible, expanding reveals two more."></div>

A collapsible is a single region that opens and closes. `Collapsible` is the root, `CollapsibleTrigger` is the control that toggles it, and `CollapsibleContent` is the body. Use it when one piece of UI should hide and show. For a stack of sections, use [Accordion](/primitives/docs/accordion).

```ts
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@implementjs/primitives";

Collapsible(
	CollapsibleTrigger("Show more"),
	CollapsibleContent("The rest of the details live here."),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div` or `Button`.

## Open state

`Collapsible` owns whether the body is open. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const open = signal(false);

Collapsible(
	{ open },
	CollapsibleTrigger("Show more"),
	CollapsibleContent("The rest of the details live here."),
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

CollapsibleContent({ class: "text-sm text-foreground/70" }, "The rest of the details live here.");
```

The `hidden` attribute already hides closed content. `data-state` is there for transitions, chevrons, and anything else that should react to open versus closed without you threading a signal through.

## Animating open and close

`CollapsibleContent` measures itself whenever it opens or closes and exposes the result as `--ip-collapsible-content-height` and `--ip-collapsible-content-width` on the element, so keyframes can animate between zero and the natural size. When the region closes, the content keeps rendering until any animation running on it finishes — only then does the `hidden` attribute go on.

```css
[data-collapsible-content] {
	overflow: hidden;
}

[data-collapsible-content][data-state="open"] {
	animation: collapsible-down 0.2s ease-out;
}

[data-collapsible-content][data-state="closed"] {
	animation: collapsible-up 0.2s ease-out;
}

@keyframes collapsible-down {
	from {
		height: 0;
	}
	to {
		height: var(--ip-collapsible-content-height);
	}
}

@keyframes collapsible-up {
	from {
		height: var(--ip-collapsible-content-height);
	}
	to {
		height: 0;
	}
}
```

Content that is open on first render does not replay its open animation on page load.

## API Reference

<div data-api="collapsible"></div>
