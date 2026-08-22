[![npm version](https://img.shields.io/npm/v/@implementjs/core.svg)](https://www.npmjs.com/package/@implementjs/core) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/core.svg)](https://www.npmjs.com/package/@implementjs/core)

# @implementjs/core

Signals, element helpers and the pieces nodes are built out of, for
[implement](https://implementjs.dev). Plain TypeScript that builds real DOM nodes, so there
is no compiler and no virtual DOM between your code and the page.

```sh
npm install @implementjs/core
```

```ts
import { App, Button, Div, H1, signal } from "@implementjs/core";

function Counter() {
	const count = signal(0);

	return Div(H1("Count: ", count), Button({ onClick: () => count.increment() }, "Increment"));
}

App({ target: document.getElementById("root")! }).render(Counter());
```

An element helper takes props and children and returns the node. A signal is a container
for a value that notifies its subscribers when it changes, and anywhere the framework takes
a value it also takes a signal, so the DOM stays in sync on its own.

## Entrypoints

| Import                       | What it is                                           |
| ---------------------------- | ---------------------------------------------------- |
| `@implementjs/core`          | Signals, control flow, element helpers, the app root |
| `@implementjs/core/elements` | Just the element helpers                             |
| `@implementjs/core/hydrate`  | Hydration for a server rendered document             |
| `@implementjs/core/server`   | Rendering a tree to HTML                             |

The client router is a package of its own,
[`@implementjs/router`](https://www.npmjs.com/package/@implementjs/router), written against
the same public API as any node you write yourself. Navigation itself — `location`,
`navigateTo`, `searchParam`, the navigation guards — stays here.

Full documentation: [implementjs.dev/docs](https://implementjs.dev/docs)
