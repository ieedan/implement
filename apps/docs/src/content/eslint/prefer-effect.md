---
title: prefer-effect
description: An ImplementLifecycle whose only job is to own a watch, which is what ImplementEffect already is.
section: Rules
order: 11
---

[`ImplementEffect`](/docs/derived) subscribes when it mounts and unsubscribes when it unmounts. An `ImplementLifecycle` whose only job is to own a `watch` is doing that by hand:

```ts
// reported
ImplementLifecycle({ onMount: () => watch([theme], (t) => apply(t)) });

// what it means
ImplementEffect([theme], (t) => apply(t));
```

The rule only fires when the swap is a genuine simplification, so it stays quiet when the `ImplementLifecycle` has children, has an `onUnmount`, has any other prop, or uses the element `onMount` is handed.

It is also careful about _which_ subscription it matches. `watch` and the standalone `subscribe` run the effect immediately with the current values, which is what a plain `ImplementEffect` does. A readable's own `subscribe` and `onChange` methods deliberately **skip** that first run, so the rule leaves them alone rather than rewriting them into an effect that behaves differently:

```ts
// not reported — onChange skips the current value, a plain effect would not
ImplementLifecycle({ onMount: () => query.onChange(refetch) });
```

`ImplementEffect([query], refetch, { immediate: false })` is the equivalent of that last one, but the previous value `onChange` passes has no counterpart on an effect, so the rewrite is yours to make.

> [!WARNING]
> `ImplementLifecycle`'s `onMount` is deferred a microtask so the subtree is connected to the document; `ImplementEffect` subscribes during mount. The suggested rewrite is offered as an ESLint _suggestion_ rather than an autofix for that reason — if the effect measures or focuses DOM, check it before applying. `oxlint --fix` will not apply it; `oxlint --fix-suggestions` will.
