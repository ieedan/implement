---
title: Introduction
description: Dark mode for a site — the visitor's choice, the system preference, and the class on the html element.
section: Start Here
order: 1
---

<div data-demo="mode-watcher" data-demo-description="Light, System, and Dark buttons above a small card whose colors follow the selected mode, with a line underneath naming the mode being rendered and the system preference."></div>

Dark mode is three questions: what did the visitor pick, what does their operating system prefer, and which of the two is the page rendering right now. `@implementjs/mode-watcher` answers all three. It is a port of [mode-watcher](https://github.com/svecosystem/mode-watcher) — a manager owns the mode, and a component mounts once at the root and keeps `<html>` in step with it.

Add it next to core:

```sh
npm install @implementjs/core @implementjs/mode-watcher
```

```ts
import { App, Button } from "@implementjs/core";
import { createModeManager, ModeWatcher } from "@implementjs/mode-watcher";

export const mode = createModeManager();

App({ target: document.body }).render(
	ModeWatcher({ manager: mode }),
	Button({ onClick: () => mode.toggleMode() }, "Toggle theme"),
);
```

This site runs on it — the switcher in the header sets the mode, and everything below `<html>` follows. That is the whole setup. `<html>` gets `class="dark"` and `style="color-scheme: dark"` when the mode is dark, the choice is remembered in `localStorage`, and the page comes back in the same mode next visit — without the flash of the wrong theme that usually comes with it.

In a [kit](/kit) app, `ModeWatcher` goes in the root layout so it stays mounted across navigations:

```ts
// src/routes/layout.ts
import { Div, Main } from "@implementjs/core";
import { ModeWatcher } from "@implementjs/mode-watcher";
import { mode } from "@/lib/mode";
import type { LayoutProps } from "./$types";

export default function Layout({ children }: LayoutProps) {
	return Div(ModeWatcher({ manager: mode }), Main(children));
}
```

[`create-implement-app`](/create) can do all of this for you — pick the `@implementjs/mode-watcher` addon and the app it scaffolds opens on a working light/dark toggle.

## Where to next

- [The manager](/mode-watcher/manager) covers what owns the mode, and how to read and change it.
- [Styling](/mode-watcher/styling) covers the classes on `<html>`, themes, and transitions.
- [First paint](/mode-watcher/first-paint) covers the blocking script that beats the flash.
- [API](/mode-watcher/api) lists every export.
