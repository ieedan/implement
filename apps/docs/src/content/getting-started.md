---
title: Getting Started
description: Set up a project and render your first component.
order: 1
---

implement is not published to a package registry yet. It lives in the [`ieedan/implement`](https://github.com/ieedan/implement) monorepo as the workspace package `@packages/implement`, and apps consume it as a workspace dependency.

## Run the repo

```
git clone https://github.com/ieedan/implement.git
cd implement
pnpm install
pnpm dev       # runs the framework in watch mode + the todo demo
pnpm dev:docs  # runs the framework in watch mode + this docs site
```

The `demos/` directory contains complete apps (a todo app and a Linear-style issue tracker) that exercise most of the framework.

## Add an app to the workspace

Create a package under `apps/` or `demos/` and depend on the framework with the workspace protocol:

```
// package.json
{
	"dependencies": {
		"@packages/implement": "workspace:*"
	}
}
```

There is no dev server package — the demos bundle with `tsdown`, style with Tailwind, and serve `index.html` statically. Any bundler that resolves workspace packages works.

## Your first component

An app needs three things: an element to mount into, an `App`, and something to render.

```ts
import { App, Button, Div, H1, signal } from "@packages/implement";

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
		<script type="module" src="./dist/index.mjs"></script>
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
