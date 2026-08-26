---
title: Elements & Props
description: Typed element factories, props, class values, styles, and events.
section: Building UI
order: 2
---

Everything on screen starts with elements, so that's where we'll start too. Every HTML element has a factory named after its tag. `Div`, `Span`, `Button`, `Input`, `A`, `Table`, and so on. All 100+ of them are exported from the package root.

```ts
import { A, Button, Div, Input, P } from "@implementjs/core";
```

A factory takes an optional props object first, then children:

```ts
Div({ class: "card" }, H2("Title"), P("Body text"));

// props are optional
Div("just text");
```

Void elements (`Input`, `Img`, `Br`, `Hr`, ...) accept no children and the type system enforces it.

## Props

Props are typed per tag. `href` on `A`, `disabled` on `Button`, `placeholder` on `Input`, and so on. `aria-*` and `data-*` attributes are typed too, and enumerated attributes (`type`, `rel`, `target`, `role`, `autocomplete`, ...) autocomplete their keyword values:

```ts
Img({ src: "/avatar.png", alt: "avatar", loading: "lazy" });
Div({ role: "status", "aria-live": "polite" });
```

`ComponentProps<typeof Div>` (or `ComponentProps<"div">`) is that props object. Extend it when wrapping a factory:

```ts
import { Div, H2, type Child, type ComponentProps } from "@implementjs/core";

type CardProps = ComponentProps<typeof Div> & { title: string };

function Card({ title, ...props }: CardProps, ...children: Child[]) {
	return Div(props, H2(title), ...children);
}
```

## Class

`class` (or `className`) takes a clsx-style value. Strings, `{ name: condition }` objects, and arrays of either, nested however you like. Falsy entries are skipped:

```ts
Div({ class: "btn" });
Div({ class: ["btn", { active: isActive }, large && "btn-lg"] });
```

## Style

`style` takes a string or an object keyed by camelCase CSS property. Custom properties use their literal `--name`:

```ts
Div({ style: { color: "red", backgroundColor: "black", "--offset": "4px" } });
```

## Events

If you want your UI to respond to user interactions you will need event handlers. They use `on` + the capitalized event name. `onClick`, `onInput`, `onKeydown`, `onSubmit`, and so on. Handlers are typed per element, so `event.target` and `event.currentTarget` are the element's own type with no casting needed.

```ts
Input({
	onInput(event) {
		console.log(event.target.value); // event.target is HTMLInputElement
	},
});
```

Append `Capture` to listen in the capture phase instead, like `onClickCapture` or `onKeydownCapture`. The handler runs on the way down the tree, before anything inside the element sees the event.

```ts
Div(
	{
		// runs before the button's own onClick
		onClickCapture: () => console.log("capture"),
	},
	Button({ onClick: () => console.log("bubble") }, "Click me"),
);
```

For `window` and `document` listeners there are dedicated helpers we'll cover later in [Window & Document](/docs/global-events).

## textContent

`textContent` sets the element's entire text as a prop. It's useful when the text is the only child and you want it settable without a child position:

```ts
Span({ textContent: "Saved!" });
```

## Other tags

`element(tag)` builds a factory for any tag name in `HTMLElementTagNameMap` (it's how the built-in factories are generated) and `component(tag, props, ...children)` is the underlying call they all delegate to:

```ts
import { component, element } from "@implementjs/core";

const Custom = element("my-element" as keyof HTMLElementTagNameMap);
const search = component("input", { type: "search" });
```

## Where's the reactivity?

Everything on this page sets values once. The real power is that **every prop and text child also accepts a signal**, so the DOM updates itself when your state changes. That's the whole subject of the [Reactivity](/docs/signals) part coming up.

But first, let's talk about how you organize elements into [components](/docs/components).
