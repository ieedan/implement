---
title: createComponent
description: Wrap a component initializer so props are optional and children can come first.
section: Utils
order: 1
---

Every primitive is built with `createComponent`. It wraps a normal component function so callers can skip an empty props object and pass children first — closer to how you call native [element factories](/docs/elements).

```ts
import { createComponent } from "@implementjs/primitives";

export const Checkbox = createComponent(function Checkbox(props, ...children) {
	return Button(props, ...children);
});
```

## With props

When you need attributes, pass a props object first:

```ts
Checkbox({ checked: true, id: "terms" });
Checkbox({ checked: true }, "Label");
```

## Without props

When you only have children — or no arguments at all — pass them directly:

```ts
Checkbox();
Checkbox("Label");
Checkbox(CheckIcon({ class: "size-4" }));
```

## Multiple children

Children stack up the same way they do on `Div` or `Button`:

```ts
Switch(SwitchThumb());
DialogContent("Hello", DialogClose("Done"));
```

## How it works

`createComponent` inspects the first argument. If it is a plain object (and not a [signal](/docs/signals)), it is treated as props. Otherwise it is treated as the first child and an empty props object is supplied internally:

```ts
Checkbox("Label");
// same as Checkbox({}, "Label");
```

That keeps primitive call sites readable while still letting you pass props whenever you need them.

## Building your own

Use `createComponent` for any component whose first argument is usually props but should be optional when you only pass children:

```ts
import { createComponent } from "@implementjs/primitives";
import { Div, type Child } from "@implementjs/core";

export const Card = createComponent(function Card(props: { class?: string }, ...children: Child[]) {
	return Div({ class: "card", ...props }, ...children);
});

Card("Hello");
Card({ class: "featured" }, "Hello");
```
