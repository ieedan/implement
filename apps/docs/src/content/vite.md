---
title: Vite
description: How the apps run on Vite — the four-line HMR recipe and the package entrypoints.
section: Building applications
order: 21
---

The apps in this repo are [Vite](https://vite.dev) projects. `vite` serves `index.html` in dev with the entry at `/src/index.ts`, Tailwind runs through `@tailwindcss/vite`, and `vite build` produces a static `dist/`. The framework needs no plugin because the package exports point at its TypeScript source, so Vite compiles it like app code.

## Hot module replacement

Vite decides how an update propagates by statically scanning each module's source for `import.meta.hot.accept(...)`, so the acceptance has to be written in the entry module itself. It cannot be hidden inside the framework. The whole recipe is four lines:

```ts
// src/index.ts
import { App } from "@implementjs/core";

const app = App({ target: document.getElementById("root")! });

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(app.unmount);
}

app.render(MyApp());
```

The app tracks every root it renders and `app.unmount` tears them all down (`render` also returns a per-root unmount function, useful for tests). On an update Vite bubbles the change up to the entry, runs the dispose hook so the old app unmounts its tree, and re-executes the entry against the updated modules, mounting a fresh app. The page patches in place instead of reloading, and module state outside the update's import chain (stores, caches) survives. CSS hot-swaps without any remount.

In production builds `import.meta.hot` is statically `false`, so the block compiles away.

This is the recipe for an app that owns its own entry. [`@implementjs/kit`](/kit) writes the entry for you and does better than a whole-app remount: it makes every `page.ts` and `layout.ts` a boundary of its own, so an edit re-renders one level of the route instead of the tree — see [while you work](/kit/routing#while-you-work).

## Entrypoints

Everything is exported from the package root, and the bigger subsystems are also importable on their own:

```ts
import { App, signal } from "@implementjs/core"; // everything
import { Div, Button } from "@implementjs/core/elements"; // the HTML element factories
import { installHydration } from "@implementjs/core/hydrate"; // adopting server markup
import { renderToString } from "@implementjs/core/server"; // rendering to HTML
```

The [router](/docs/router) is a package of its own, `@implementjs/router`, written against the same public API as [any other node](/docs/custom-nodes).

You've now seen every piece on its own. The last page [puts them all together](/docs/building-an-app) into a complete application.
