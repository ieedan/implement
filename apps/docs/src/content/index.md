---
title: Introduction
description: A signal-based UI framework with fine-grained reactivity, good ergonomics, and no compiler.
order: 0
---

implement is a signal-based UI framework for the browser. There is no compiler, no JSX, and no virtual DOM — your app is plain TypeScript that builds real DOM nodes, and signals update exactly the parts of the page that depend on them.

```ts
import { App, Button, Div, signal } from "@implementjs/core";

const app = App({ target: document.body });

function Counter() {
	const count = signal(0);

	return Div(Button({ onClick: () => count.increment() }, "Count: ", count));
}

app.render(Counter());
```

Clicking the button updates a single text node. Nothing re-renders, nothing diffs — the `count` signal is subscribed directly to the DOM it feeds.

## What's in the box

- **[Signals](/docs/signals)** — writable values with `get`/`set`/`update`, plus [derived values](/docs/derived) and [two-way bindings](/docs/bindings) into nested data.
- **[Typed elements](/docs/elements)** — a factory for every HTML element (`Div`, `Button`, `Input`, …) with typed props, clsx-style `class` values, style objects, typed event handlers, and two-way form bindings.
- **[Components](/docs/components)** — just functions. No lifecycle rules, no hooks, no dependency arrays.
- **Control flow as components** — [`If`](/docs/if), [`Switch`](/docs/switch), [`ForEach`](/docs/foreach), [`Key`](/docs/key), and [`Await`](/docs/await) mount and unmount real DOM in response to signals.
- **[Context](/docs/context)** — pass values down the tree without prop drilling.
- **Framework helpers** — [lifecycle hooks](/docs/lifecycle), [error boundaries](/docs/boundary), [portals](/docs/portal), [raw HTML](/docs/html), [SVG](/docs/svg), [document head management](/docs/head), and [window/document event listeners](/docs/global-events).
- **[A typed router](/docs/router)** — a nested route table with typed params, persistent layouts, typed links, and URL-synced search params.

## The mental model

Three ideas carry the whole framework:

1. **Components run once.** A component function builds its element tree a single time. There is no re-render, so you never think about referential stability, memoization, or stale closures.
2. **Signals carry change.** Anywhere a prop or text child accepts a value, it also accepts a `Readable` of that value. The element subscribes on mount and unsubscribes on unmount.
3. **Helpers own structure.** When the _shape_ of the DOM needs to change — a branch appears, a list reorders, a promise resolves — a helper component (`If`, `ForEach`, `Await`, …) mounts and unmounts subtrees for you.

Head over to [Getting Started](/docs/getting-started) to run it yourself.
