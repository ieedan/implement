---
title: Introduction
description: A signal-based UI framework with fine-grained reactivity, good ergonomics, and no compiler.
section: Start here
order: 0
---

implement is a signal-based UI framework for the browser. There is no compiler, no JSX, and no virtual DOM. Your app is plain TypeScript that builds real DOM nodes, and signals update exactly the parts of the page that depend on them.

```ts
import { App, Button, Div, signal } from "@implementjs/core";

const app = App({ target: document.body });

function Counter() {
	const count = signal(0);

	return Div(Button({ onClick: () => count.increment() }, "Count: ", count));
}

app.render(Counter());
```

When you click the button a single text node updates. Nothing re-renders and nothing diffs because the `count` signal is subscribed directly to the DOM it feeds.

## What's in the box

- **[Signals](/docs/signals)** are writable values with `get`, `set`, and `update`, plus [derived values](/docs/derived) and [two-way bindings](/docs/bindings) into nested data.
- **[Typed elements](/docs/elements)** give you a factory for every HTML element (`Div`, `Button`, `Input`, ...) with typed props, clsx-style `class` values, style objects, typed event handlers, and two-way form bindings.
- **[Components](/docs/components)** are just functions. No lifecycle rules, no hooks, no dependency arrays.
- **Control flow is components too.** [`If`](/docs/if), [`Switch`](/docs/switch), [`ForEach`](/docs/foreach), [`Key`](/docs/key), and [`Await`](/docs/await) mount and unmount real DOM in response to signals.
- **[Context](/docs/context)** passes values down the tree without prop drilling.
- **Framework helpers** cover the rest: [lifecycle hooks](/docs/lifecycle), [error boundaries](/docs/boundary), [portals](/docs/portal), [raw HTML](/docs/html), [SVG](/docs/svg), [document head management](/docs/head), and [window/document event listeners](/docs/global-events).
- **[A typed router](/docs/router)** describes your app as a nested route table with typed params, persistent layouts, typed links, and URL-synced search params. It ships as `@implementjs/router`, built on the same [node-authoring API](/docs/custom-nodes) you have.
- **[Primitives](/primitives)** are unstyled, composable building blocks for common UI patterns, starting with [Accordion](/primitives/docs/accordion).

## The mental model

There are really only three ideas you need to keep in your head:

1. **Components run once.** A component function builds its element tree a single time. There is no re-render, so you never think about referential stability, memoization, or stale closures.
2. **Signals carry change.** Anywhere a prop or text child accepts a value it also accepts a `Readable` of that value. The element subscribes on mount and unsubscribes on unmount.
3. **Helpers own structure.** When the shape of the DOM needs to change (a branch appears, a list reorders, a promise resolves) a helper component like `If`, `ForEach`, or `Await` mounts and unmounts subtrees for you.

## How to read these docs

The docs are written to be read in order, like a book. Each page builds on the one before it, starting from nothing and ending with everything you need to build complete applications. If you would rather learn by doing, the interactive [tutorial](/tutorial) covers the same ground with live code.

Head over to [Getting Started](/docs/getting-started) to run it yourself.
