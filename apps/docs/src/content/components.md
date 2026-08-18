---
title: Components
description: Components are plain functions that run once and return mountables.
order: 3
---

A component is a function that returns something renderable. That's the whole contract — no base class, no registration, no hooks.

```ts
function UserCard(user: Readable<User>) {
	return Div(
		{ class: "card" },
		Img({ src: user.bind("avatarUrl"), alt: "" }),
		Div(user.bind("name")),
	);
}
```

Because a component runs **once**, local variables are stable for the life of the component. State is just a signal in scope:

```ts
function Search() {
	const query = signal("");

	return Div(Input({ value: query, placeholder: "Search…" }), P("Searching for: ", query));
}
```

## Children

Anything that accepts children accepts the `Child` type:

- **Mountables** — the result of element factories, helpers, and your own components.
- **Text primitives** — `string`, `number`; `null`, `undefined`, and `false` render nothing, which makes `cond && Div(...)` work inline.
- **Readables** — a `Readable` of a text primitive becomes a live text node.

```ts
Div(
	"Hello ", // static text
	name, // live text (a signal)
	P("a paragraph"), // an element
	isAdmin && Badge(), // conditionally present (fixed at creation time)
);
```

`cond && Badge()` is evaluated once when the tree is built. For conditions that change over time, use [`If`](/docs/if).

A component that takes children just accepts them as parameters and passes them through:

```ts
function Card(title: string, ...children: Child[]) {
	return Div({ class: "card" }, H3(title), ...children);
}
```

## Fragment

`Fragment` groups children without a wrapper element — handy when a component needs to return siblings:

```ts
import { Fragment } from "@implementjs/core";

function LabeledInput(label: string, value: Signal<string>) {
	return Fragment({}, Label(label), Input({ value }));
}
```

## Under the hood: Mountable

Everything renderable is a `Mountable`: a factory `() => IMountable`, where `IMountable` has `mount(parent)`, `unmount()`, and `getFirstDomNode()`. Element factories return one, helpers return one, and your components return one because they return the result of a factory. You rarely touch this interface directly, but it is the extension point if you ever need a fully custom renderable — and it is why components compose freely: there is only one kind of thing in the tree.

Reusing a single mountable instance in two places is not supported; call the component function once per place it appears.
