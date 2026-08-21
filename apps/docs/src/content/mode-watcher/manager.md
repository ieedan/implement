---
title: The manager
description: The object that owns the mode — what it exposes, and how to change what the page renders.
section: Guides
order: 10
---

`createModeManager()` returns the object that owns the mode. Create it at module scope so any code — a menu item, a keyboard shortcut, a settings page — can import it and change the mode; the mounted `ModeWatcher` applies whatever it holds.

```ts
// src/lib/mode.ts
import { createModeManager } from "@implementjs/mode-watcher";

export const mode = createModeManager();
```

It exposes four [readables](/docs/signals) and four methods:

```ts
mode.mode; // Readable<"dark" | "light" | undefined> — what the page is rendering
mode.userPrefersMode; // Readable<"dark" | "light" | "system"> — what was picked
mode.systemPrefersMode; // Readable<"dark" | "light" | undefined> — what the OS reports
mode.theme; // Readable<string> — the current data-theme

mode.setMode("dark"); // pick a mode, and remember it
mode.toggleMode(); // flip between light and dark
mode.resetMode(); // forget the choice and follow the OS again
mode.setTheme("mint"); // set data-theme on <html>
```

`mode` is the one to render against — it is the visitor's choice, or the system preference when that choice is `"system"`:

```ts
Button(
	{ onClick: () => mode.toggleMode() },
	mode.mode.bind((current) => (current === "dark" ? "Light mode" : "Dark mode")),
);
```

It is `undefined` during a server render, where there is no operating system to ask. That is only true while `userPrefersMode` is `"system"`; an explicit `"dark"` resolves on the server too.

`toggleMode` flips from what is rendering, not from what was picked — toggling out of `"system"` on a dark machine lands on `"light"`, which is what the visitor expects from a button they can see.

`ModeWatcher` makes its own manager when it is not given one. That is enough when nothing but the component needs the mode, but a manager you can import is what makes the mode reachable from the rest of the app.

## Following the system

With no stored choice the mode is `"system"` — the manager reads `prefers-color-scheme` and follows it as it changes, so a machine that switches at sunset switches the page with it. `track: false` keeps the initial reading and stops listening. `defaultMode` picks what an unset visitor gets instead:

```ts
createModeManager({ defaultMode: "dark" });
```

The choice is stored under `implement-mode` (and the theme under `implement-theme`); `modeStorageKey` and `themeStorageKey` rename them. The manager also listens for `storage` events, so changing the mode in one tab changes it in the others.

## Nothing happens until it is mounted

A manager on its own is state. It touches no DOM, reads no media query, and follows no other tab until a mounted `ModeWatcher` starts it — which is what makes one safe to create at module scope in a server-rendered app, and what stops a test from leaking listeners into the next one.
