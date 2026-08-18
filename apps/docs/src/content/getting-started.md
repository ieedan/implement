---
title: Getting Started
description: Set up a project and render your first component.
order: 1
---

implement is not published to a package registry yet. It lives in the [`ieedan/implement`](https://github.com/ieedan/implement) monorepo as the workspace package `@implementjs/core`, and apps consume it as a workspace dependency.

## Run the repo

```
git clone https://github.com/ieedan/implement.git
cd implement
pnpm install
pnpm dev       # runs the todo demo (Vite + its API server)
pnpm dev:docs  # runs this docs site (Vite + Velite in watch mode)
```

The `demos/` directory contains complete apps (a todo app and a Linear-style issue tracker) that exercise most of the framework.

## Add an app to the workspace

Create a package under `apps/` or `demos/` and depend on the framework with the workspace protocol:

```
// package.json
{
	"dependencies": {
		"@implementjs/core": "workspace:*"
	}
}
```

The demos are [Vite](https://vite.dev) apps: `vite` serves `index.html` in dev (Tailwind runs through `@tailwindcss/vite`), and `vite build` produces a static `dist/`. Hot module replacement is a [four-line block in the entry](/docs/vite). The package exports point at its TypeScript source, so any bundler that resolves workspace packages works — no framework build step is involved.

## Your first component

An app needs three things: an element to mount into, an `App`, and something to render.

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

```
// index.html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<script type="module" src="/src/index.ts"></script>
	</head>
	<body id="root"></body>
</html>
```

## What just happened

- `App({ target })` creates the root. `app.render(...children)` mounts children into it.
- `Counter` is a plain function. It runs **once** — there is no re-render.
- `Div(...)`, `H1(...)`, and `Button(...)` are element factories. The first argument may be a props object; everything after (or instead) is children.
- `signal(0)` creates a writable value. Passing it as a child creates a text node that updates whenever the signal changes.
- `count.increment()` is one of the built-in [signal helpers](/docs/signals) — `count.update((n) => n + 1)` and `count.set(count.get() + 1)` do the same thing.

From here, read [Elements & Props](/docs/elements) for what element factories accept, or [Signals](/docs/signals) for the reactivity model.
