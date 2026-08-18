---
title: Reactive collections
description: Implement.Set and Implement.Map are real Sets and Maps that notify the DOM when they change.
section: Reactivity
order: 6.5
---

Sets and maps are awkward to hold in a signal: `set()` deep-equality doesn't apply to them, and mutating one in place doesn't notify anyone. `Implement.Set` and `Implement.Map` fix that. They create a **real** `Set`/`Map` (instanceof and all) that is also a `Readable`, so mutating it notifies subscribers and everything downstream stays in sync.

```ts
import { Implement } from "@implementjs/core";

const selected = Implement.Set<string>();

selected.add("a"); // notifies
selected.delete("a"); // notifies
selected.toggle("a"); // add-or-delete convenience, notifies
selected.has("a"); // plain read, not reactive
```

Use them anywhere you would reach for a `Set` or `Map` in app state: selection sets, per-id drafts, expanded/collapsed trees, caches keyed by id.

## Reading reactively

The collection itself supports every normal `Set`/`Map` read (`has`, `size`, `get(key)`, iteration) — those are plain, non-reactive reads. To react to changes, go through the `Readable` surface: `bind`, `derived`, `watch`, or a prop. Subscribers receive an **immutable snapshot** (a plain `ReadonlySet`/`ReadonlyMap`), so a value you derived from is never mutated out from under you.

```ts
const selected = Implement.Set<string>();

Span(selected.bind((s) => `${s.size} selected`));

If(selected.bind((s) => s.has(id))).Then(Span("Selected"));

Div({ class: { active: selected.bind((s) => s.has(id)) } });

ForEach(
	selected.bind((s) => [...s]),
	(id) => id,
	(id) => Row(id),
);
```

Mutations that change nothing (`add` of an existing value, `delete` of a missing key, `set` of an identical value, `clear` of an empty collection) do not notify.

## Implement.Map

`Implement.Map` works the same way. The one wrinkle is `get`: `map.get(key)` is the ordinary `Map` entry read, while `map.get()` with no arguments is the readable's snapshot read (what `derived` and `watch` see).

```ts
const drafts = Implement.Map<string, string>();

Textarea({
	value: drafts.bind((d) => d.get(issueId) ?? ""),
	onInput: (ev) => drafts.set(issueId, ev.currentTarget.value),
});

const dirtyCount = drafts.bind("size");
```

## In-place mutation of stored values

Replacing an entry notifies, but mutating an object _stored inside_ the collection does not — the collection can't see it. After an in-place mutation, call `flush()` to notify subscribers with a fresh snapshot:

```ts
const todos = Implement.Map<string, { title: string; done: boolean }>();

todos.get(id)!.done = true; // silent
todos.flush(); // now everyone hears about it
```

Prefer replacing the entry (`todos.set(id, { ...todo, done: true })`) when it's just as easy.

## When to use a signal instead

`signal(new Set())` still works — replace the whole collection via `set()` and treat it as immutable. Reach for `Implement.Set`/`Implement.Map` when you want to call the collection's own mutators and have the DOM follow, without copying on every change yourself.
