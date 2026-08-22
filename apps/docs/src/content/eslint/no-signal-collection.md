---
title: no-signal-collection
description: A Set or Map inside a signal, where ImplementSet and ImplementMap notify on their own mutators.
section: Rules
order: 13
---

A signal notifies when you `set` it. Put a `Set` or a `Map` inside one and mutating it in place notifies nobody, so every change means copying the whole collection back through `set`:

```ts
const selected = signal(new Set<string>());

selected.update((s) => {
	const next = new Set(s);
	next.add(id);
	return next;
});
```

[`ImplementSet` and `ImplementMap`](/docs/reactive-collections) are real `Set`s and `Map`s that are also readables, so their own mutators notify:

```ts
const selected = ImplementSet<string>();
selected.add(id); // notifies
```

The rule reports a `signal()` holding a collection, whether that is visible from the value (`signal(new Set())`), the type argument (`signal<Map<string, number>>()`), or the annotation on the declaration (`const x: Signal<Set<string>> = …`). The suggestion rewrites the call and adds the import, but only when there is no annotation left describing the old shape.

## Opting out

Writing the **readonly** type is taken as a deliberate statement that the collection is replaced rather than mutated — which is a perfectly good reason to keep it in a signal — and opts out:

```ts
// not reported: replace-don't-mutate is the intent, and it is written down
const touched = signal<ReadonlySet<string>>(new Set());
```
