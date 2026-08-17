---
title: Window & Document
description: Attach window and document event listeners whose lifetime follows their position in the tree.
order: 19
---

`Implement.Window` and `Implement.Document` attach event listeners to the global objects for as long as they are mounted — the counterpart of Svelte's `<svelte:window>`/`<svelte:document>`. They render nothing.

```ts
import { Implement } from "@packages/implement";

Implement.Window({ onResize: relayout, onHashchange: onRoute });

Implement.Document({ onKeydown: handleShortcuts });
```

## Lifetime follows tree position

Because listeners attach on mount and detach on unmount, placing one inside a branch scopes it to that branch — no manual `addEventListener`/`removeEventListener` bookkeeping:

```ts
If(menuOpen).Then(
	MenuPanel(),
	Implement.Document({
		onMousedown: (event) => {
			if (!panel.get()?.contains(event.target as Node)) menuOpen.set(false);
		},
		onKeydown: (event) => {
			if (event.key === "Escape") menuOpen.set(false);
		},
	}),
);
```

When the menu closes, the branch unmounts and both listeners detach.

## Props

- Handlers use the same `on` + capitalized name convention as elements, typed against `WindowEventMap` / `DocumentEventMap`: `onResize`, `onScroll`, `onKeydown`, `onVisibilitychange`, `onPopstate`, …
- Append `Capture` to listen in the capture phase: `onMousedownCapture`, `onFocusinCapture`.
- A handler can be a `Readable` of a function; the listener is swapped when it changes.
- `event.target` is not narrowed to the global object — for a document `keydown` it is whatever element had focus, as in the browser.
