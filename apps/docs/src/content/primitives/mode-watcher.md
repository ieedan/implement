---
title: Mode Watcher
description: Dark mode for a site — the visitor's choice, the system preference, and the class on the html element.
section: Components
---

<div data-demo="mode-watcher" data-demo-description="Light, System, and Dark buttons above a small card whose colors follow the selected mode, with a line underneath naming the mode being rendered and the system preference."></div>

Dark mode is three questions: what did the visitor pick, what does their operating system prefer, and which of the two is the page rendering right now. `ModeWatcher` answers all three. It is a port of [mode-watcher](https://github.com/svecosystem/mode-watcher) — a manager owns the mode, the component mounts once at the root and keeps `<html>` in step with it.

```ts
import { App, Button } from "@implementjs/core";
import { createModeManager, ModeWatcher } from "@implementjs/primitives";

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
import { ModeWatcher } from "@implementjs/primitives";
import { mode } from "@/lib/mode";
import type { LayoutProps } from "./$types";

export default function Layout({ children }: LayoutProps) {
	return Div(ModeWatcher({ manager: mode }), Main(children));
}
```

## The manager

`createModeManager()` returns the object that owns the mode. Create it at module scope so any code — a menu item, a keyboard shortcut, a settings page — can import it and change the mode; the mounted `ModeWatcher` applies whatever it holds.

It exposes three [readables](/docs/signals) and four methods:

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

## Styling against the mode

The primitive puts classes on `<html>` and nothing else — the look is yours. With Tailwind, that is the `dark:` variant; with plain CSS, a `.dark` selector:

```css
:root {
	--background: white;
	--foreground: black;
}

.dark {
	--background: black;
	--foreground: white;
}
```

`darkClassNames` and `lightClassNames` change which classes those are. Both are arrays, so a framework that wants `theme-dark` alongside `dark` can have both, and a light mode that needs its own marker class can add one:

```ts
createModeManager({
	darkClassNames: ["dark", "theme-dark"],
	lightClassNames: ["theme-light"],
});
```

`color-scheme` is set on `<html>` either way. It is what tells the browser to render scrollbars, form controls, and the space beyond the page in the matching shade, so those don't stay light while everything else goes dark.

## No flash of the wrong theme

Applying the mode after the app mounts is too late — the page has already painted in the wrong colors. `ModeWatcher` renders a small blocking script into `<head>` that reads `localStorage`, resolves the mode, and puts the class on `<html>` before the first paint. It runs during a server render too, so the markup a [kit](/kit) app ships already carries it.

If the script has to live somewhere else — inlined into an `index.html`, or injected by a server hook — `createInitialModeExpression` returns its source, and `injectScript: false` stops the component from adding a second one:

```ts
import { createInitialModeExpression } from "@implementjs/primitives";

const source = createInitialModeExpression({ defaultMode: "dark" });
```

Pass the same options you gave the manager: the script and the manager have to agree, or the page corrects itself visibly a moment after it loads. Under a Content Security Policy, `nonce` puts one on the injected script.

## Following the system

With no stored choice the mode is `"system"` — the manager reads `prefers-color-scheme` and follows it as it changes, so a machine that switches at sunset switches the page with it. `track: false` keeps the initial reading and stops listening. `defaultMode` picks what an unset visitor gets instead:

```ts
createModeManager({ defaultMode: "dark" });
```

The choice is stored under `implement-mode` (and the theme under `implement-theme`); `modeStorageKey` and `themeStorageKey` rename them. The manager also listens for `storage` events, so changing the mode in one tab changes it in the others.

## Themes

Dark and light are the mode. A theme is the palette underneath it, and the two are independent: `setTheme("mint")` writes `data-theme="mint"` on `<html>` and remembers it, in whichever mode the page happens to be in.

```css
[data-theme="mint"] {
	--primary: oklch(0.72 0.15 165);
}
```

`setTheme("")` removes the attribute. `defaultTheme` sets the one to start from.

## Browser chrome

`themeColors` keeps `<meta name="theme-color">` — the color mobile browsers paint their chrome with — in step with the mode:

```ts
createModeManager({ themeColors: { dark: "#0a0a0a", light: "#ffffff" } });
```

`ModeWatcher` renders the meta tag when the option is set, and the blocking script fills in the right color before the first paint.

## Transitions

A page that transitions its colors will animate every one of them at once when the mode flips, which reads as a smear rather than a change. The manager suppresses transitions for the duration of the swap and lifts the suppression on the next frame. `disableTransitions: false` keeps them if the smear is the point.

## API Reference

<div data-api="mode-watcher"></div>
