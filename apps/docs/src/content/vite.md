---
title: Vite
description: How the apps run on Vite — the four-line HMR recipe and the package entrypoints.
order: 21
---

The apps in this repo are [Vite](https://vite.dev) projects: `vite` serves `index.html` in dev with the entry at `/src/index.ts`, Tailwind runs through `@tailwindcss/vite`, and `vite build` produces a static `dist/`. The framework needs no plugin — the package exports point at its TypeScript source, so Vite compiles it like app code.

## Hot module replacement

Vite decides how an update propagates by statically scanning each module's source for `import.meta.hot.accept(...)`, so the acceptance has to be written in the entry module itself — it cannot be hidden inside the framework. The whole recipe is four lines:

```ts
// src/index.ts
import { App } from "@packages/implement";
import { disposeRoots } from "@packages/implement/hmr";

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(disposeRoots);
}

const app = App({ target: document.getElementById("root")! });
app.render(MyApp());
```

`App().render(...)` registers every mounted root in a dev-only registry (and returns its own unmount function, useful for tests). On an update, Vite bubbles the change up to the entry, runs the dispose hook — `disposeRoots` unmounts the old tree — and re-executes the entry against the updated modules. The page patches in place instead of reloading; module state outside the update's import chain (stores, caches) survives. CSS hot-swaps without any remount.

In production builds `import.meta.hot` is statically `false`, so the block and the registry compile away.

## Entrypoints

Everything is exported from the package root, and the bigger subsystems are also importable on their own:

```ts
import { App, signal } from "@packages/implement"; // everything
import { Div, Button } from "@packages/implement/elements"; // the HTML element factories
import { Router } from "@packages/implement/router"; // the router
import { disposeRoots } from "@packages/implement/hmr"; // dev-time root teardown
```
