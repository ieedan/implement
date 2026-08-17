---
title: Vite
description: The Vite plugin — hot module replacement with no app-side wiring — and the package entrypoints.
order: 21
---

The apps in this repo are [Vite](https://vite.dev) projects. The framework ships a Vite plugin from the `@packages/implement/vite` entrypoint that wires up hot module replacement — no HMR code in the app itself.

```ts
// vite.config.ts
import { implement } from "@packages/implement/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [implement()],
});
```

## What the plugin does

Vite decides how an update propagates by statically scanning each module's source for `import.meta.hot.accept(...)` — a runtime `accept()` call made from inside the framework would not register, and every edit would fall through to a full page reload. So the plugin injects the acceptance into the right place at transform time: each entry module referenced by `index.html`'s `<script type="module">` tags gets a footer that self-accepts updates and, before re-executing, unmounts every mounted `App` root.

The effect: edit any module in the app's graph and the update bubbles to the entry, the old tree unmounts, and the entry re-runs against the updated modules — the page patches in place. Module state outside the update's import chain (stores, caches) survives; the re-mounted tree renders against it. CSS hot-swaps without any remount.

`App().render(...)` returns the unmount function that makes this teardown possible; it is also useful on its own (tests, embedding).

The plugin only applies to the dev server — `vite build` output is untouched.

## Entrypoints

Everything is exported from the package root, and the bigger subsystems are also importable on their own:

```ts
import { App, signal } from "@packages/implement"; // everything
import { Div, Button } from "@packages/implement/elements"; // the HTML element factories
import { Router } from "@packages/implement/router"; // the router
import { implement } from "@packages/implement/vite"; // the Vite plugin (node-side)
```

`@packages/implement/hmr` also exists — it holds the mounted-root registry the injected HMR glue tears down; apps normally never import it directly.
