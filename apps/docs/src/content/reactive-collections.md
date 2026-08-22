---
title: Reactive collections
description: Real Sets and Maps that notify the DOM when they change, via ImplementSet and ImplementMap.
section: Reactivity
order: 6.5
---

Some state is naturally a `Set` or a `Map`: the rows you've selected, a draft per issue, which tree nodes are expanded. You _can_ hold one in a [signal](/docs/signals), but then every change means copying the whole collection just to call `set()`:

```ts
const selected = signal(new Set<string>());

selected.update((s) => {
	const next = new Set(s);
	next.add(id);
	return next;
});
```

`ImplementSet` and `ImplementMap` skip the ceremony. They create a **real** `Set`/`Map` (`instanceof` and all) that is also a `Readable`, so calling its own mutators notifies subscribers and the DOM follows:

```ts
import { ImplementEffect, ImplementMap, ImplementSet } from "@implementjs/core";

const selected = ImplementSet<string>();

selected.add(id); // notifies
selected.delete(id); // notifies
selected.toggle(id); // add-or-delete convenience, notifies
selected.has(id); // plain read, not reactive
```

## Reading reactively

The collection supports every normal `Set`/`Map` read (`has`, `size`, `get(key)`, iteration), and those are plain, non-reactive reads. To react to changes you go through the readable surface you already know: [`bind`](/docs/bindings), [`derived`](/docs/derived), `ImplementEffect`, or a prop.

```ts
const selected = ImplementSet<string>();

Span(selected.bind((s) => `${s.size} selected`));

If(selected.bind((s) => s.has(id))).Then(Span("Selected"));

Div({ class: { active: selected.bind((s) => s.has(id)) } });

ForEach(
	selected.bind((s) => [...s]),
	(id) => id,
	(id) => Row(id),
);
```

Subscribers receive an **immutable snapshot** — a plain `ReadonlySet`/`ReadonlyMap` — so a value you derived from is never mutated out from under you, and `onChange` gets a genuinely different previous value to compare against.

Mutations that change nothing don't notify: adding a value that's already there, deleting a missing key, `set` of an identical value, clearing an empty collection.

## ImplementMap

`ImplementMap` works the same way, with its own mutators (`set`, `delete`, `clear`):

```ts
const drafts = ImplementMap<string, string>();

Textarea({
	value: drafts.bind((d) => d.get(issueId) ?? ""),
	onInput: (ev) => drafts.set(issueId, ev.currentTarget.value),
});

const dirtyCount = drafts.bind("size");
```

> [!NOTE]
> `get` wears two hats here. `drafts.get(key)` is the ordinary `Map` entry read; `drafts.get()` with no arguments is the readable's snapshot read (what `derived` and `watch` see). Both are fully typed.

## In-place mutation of stored values

Replacing an entry notifies, but mutating an object _stored inside_ the collection does not — the collection can't see it. After an in-place mutation, call `flush()` to notify subscribers with a fresh snapshot:

```ts
const todos = ImplementMap<string, { title: string; done: boolean }>();

todos.get(id)!.done = true; // silent
todos.flush(); // now everyone hears about it
```

Prefer replacing the entry (`todos.set(id, { ...todo, done: true })`) when it's just as easy.

That wraps up reactivity. You can hold state, derive from it, zoom into it, and mutate collections of it. The next part is about changing the **shape** of the DOM when state changes, starting with [If](/docs/if).
