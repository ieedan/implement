---
title: Components
description: Components are plain functions that run once and return mountables.
section: Building UI
order: 3
---

Now that you can build elements you will want to group them into reusable pieces. In implement a component is just a function that returns something renderable. That's the whole contract. No base class, no registration, no hooks.

```ts
function UserCard(user: User) {
	return Div({ class: "card" }, Img({ src: user.avatarUrl, alt: "" }), Div(user.name));
}
```

Because a component runs **once**, local variables are stable for the life of the component. There is no re-render, so you never think about referential stability, memoization, or stale closures.

## Children

Anything that accepts children accepts the `Child` type:

- **Mountables** are the result of element factories, helpers, and your own components.
- **Text primitives** are `string` and `number`. `null`, `undefined`, and `false` render nothing, which is what makes `cond && Div(...)` work inline.
- **Readables** (signals, which you'll meet in the next part) become live text nodes.

```ts
Div(
	"Hello ", // static text
	P("a paragraph"), // an element
	isAdmin && Badge(), // conditionally present (fixed at creation time)
);
```

Keep in mind that `cond && Badge()` is evaluated once when the tree is built. For conditions that change over time there is [`If`](/docs/if), coming up in the Control flow part.

If your component takes children it just accepts them as parameters and passes them through:

```ts
function Card(title: string, ...children: Child[]) {
	return Div({ class: "card" }, H3(title), ...children);
}
```

## Fragment

Sometimes a component needs to return siblings without a wrapper element. `Fragment` groups children for exactly that:

```ts
import { Fragment } from "@implementjs/core";

function Legend(term: string, definition: string) {
	return Fragment(Dt(term), Dd(definition));
}
```

## Under the hood: Mountable

Everything renderable is a `Mountable`. It's a factory `() => IMountable`, where `IMountable` has `mount(parent)`, `unmount()`, and `getFirstDomNode()`. Element factories return one, helpers return one, and your components return one because they return the result of a factory. You will rarely touch this interface directly, but it is the extension point if you ever need a fully custom renderable. It's also why components compose so freely, there is only one kind of thing in the tree.

> [!NOTE]
> Reusing a single mountable instance in two places is not supported. Call the component function once per place it appears.

So far everything we've built is static. It renders once and never changes. Time to fix that with [signals](/docs/signals).
