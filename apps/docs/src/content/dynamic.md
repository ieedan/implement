---
title: Dynamic
description: Mount whatever node a signal is holding, and swap it when the value changes.
section: Control flow
order: 11.5
---

`If` tests conditions and `Switch` matches values against branches you write out ahead of time. `Dynamic` goes the other way: the node itself comes out of a signal, and swapping what renders is a `set` away.

```ts
import { Dynamic, signal } from "@implementjs/core";

const view = signal(Dashboard());

Div(Dynamic(view));

view.set(Settings()); // Dashboard unmounts, Settings takes its place
```

## Two forms

A readable of a child, or signals and a getter — the same pair `Switch` takes:

```ts
// a readable that already holds the node
const icon = derived([priority], (p) => PRIORITIES[p].icon());
SelectTrigger(Dynamic(icon));

// or build it inline, no intermediate readable
SelectTrigger(Dynamic([priority], (p) => PRIORITIES[p].icon()));
```

The second form is usually what you want when the node is derived from state rather than stored as state. It reads the same as `Switch`, minus a case per value:

```ts
// every priority, without writing a case for each
Dynamic([priority], (p) => PRIORITIES[p].icon());
```

Use `Switch` when the branches are a fixed, known set and you want [exhaustiveness](/docs/switch#exhaustiveness). Use `Dynamic` when they come from a table, a registry, or a signal someone else fills in.

## What counts as a change

The value is compared by identity. A getter that builds a fresh node per call — `PRIORITIES[p].icon()` — produces a different value every time its sources change, so it swaps every time. A getter that returns something it already holds leaves what's mounted alone:

```ts
const ICONS = { high: HighIcon(), low: LowIcon() };

// `high` → `low` swaps; a source changing without changing the icon does not
Dynamic([priority], (p) => ICONS[p]);
```

Remounting the _same_ node on a signal change is [`Key`](/docs/key)'s job, not this one's.

## Notes

- `null` and `undefined` render nothing, so a `Readable<Mountable | null>` is a first-class shape — no `If` around the empty case.
- Any [child](/docs/components) works, not only nodes. A string becomes text, a readable becomes text that follows it.
- Children mount at the `Dynamic`'s position in the tree, so [context](/docs/context) resolves through it, errors reach the nearest [boundary](/docs/boundary), and server rendering and hydration go through the same path as any other child.
- It holds one region. For several nodes at once, return a [`Fragment`](/docs/components#fragment).
- A readable of a node is not a child on its own: `Div(view)` renders text, because a readable child _is_ the text-node shape. `Dynamic` is how you say you meant the node.

That's every control-flow helper. The next part is about structuring bigger apps, starting with sharing state through [Context](/docs/context).
