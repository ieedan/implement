---
title: Getting Started
description: Set up a project and render your first component.
section: Start here
order: 1
---

implement ships as `@implementjs/core`: signals, element helpers, and a router, in plain TypeScript with no compiler and no build step of its own.

## Setup

<div data-tab="Automatic"></div>

[`create-implement-app`](/create) writes a working app for you — a [kit](/kit) app or a plain Vite one, with Tailwind, [primitives](/primitives), and [icons](/lucide) as optional addons:

```sh
npm create implement-app@latest
```

Answer three questions and you have an app you can `dev` immediately. [Templates](/create/templates) covers what each starting point writes.

<div data-tab="Manual"></div>

Adding implement to a project you already have takes one dependency:

```sh
npm install @implementjs/core
```

That's the only one the framework needs. The package exports point at its TypeScript source, so any bundler that can resolve a package will work — there is no framework build step involved.

[Vite](https://vite.dev) is what the templates use and what these docs assume: `vite` serves `index.html` in dev (Tailwind runs through `@tailwindcss/vite`) and `vite build` produces a static `dist/`. Hot module replacement is a [four line block in the entry](/docs/vite).

For unstyled UI building blocks on top of core, add [`@implementjs/primitives`](/primitives) alongside it.

<div data-tabs-end></div>

## Run the repo

```sh
git clone https://github.com/ieedan/implement.git
cd implement
pnpm install
pnpm dev       # runs this docs site (Vite + Velite in watch mode)
```

## Your first component

An app needs three things. An element to mount into, an `App`, and something to render.

```ts
import { App, Button, Div, H1, signal } from "@implementjs/core";

const app = App({ target: document.getElementById("root")! });

function Counter() {
	const count = signal(0);

	return Div(H1("Counter"), Button({ onClick: () => count.increment() }, "Count: ", count));
}

app.render(Counter());
```

With an `index.html` like:

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<script type="module" src="/src/index.ts"></script>
	</head>
	<body id="root"></body>
</html>
```

That's the whole setup — which is exactly what the [`csr` template](/create/templates) writes for you.

## What just happened

- `App({ target })` creates the root and `app.render(...children)` mounts children into it.
- `Counter` is a plain function. It runs **once**, there is no re-render.
- `Div(...)`, `H1(...)`, and `Button(...)` are element factories. The first argument can be a props object and everything after (or instead) is children.
- `signal(0)` creates a writable value. Passing it as a child creates a text node that updates whenever the signal changes.
- `count.increment()` is one of the built-in [signal helpers](/docs/signals). `count.update((n) => n + 1)` and `count.set(count.get() + 1)` do the same thing.

There's a lot packed into that little counter. Over the next pages we'll unpack all of it, starting with the thing you'll touch most: [elements](/docs/elements).
