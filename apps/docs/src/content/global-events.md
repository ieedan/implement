---
title: Window & Document
description: Attach window and document event listeners whose lifetime follows their position in the tree.
section: The document
order: 19
---

Some events don't belong to any element in your tree, they belong to the page. `Implement.Window` and `Implement.Document` attach event listeners to the global objects for as long as they are mounted (the counterpart of Svelte's `<svelte:window>`/`<svelte:document>`). They render nothing.

```ts
import { Implement } from "@implementjs/core";

Implement.Window({ onResize: relayout, onHashchange: onRoute });

Implement.Document({ onKeydown: handleShortcuts });
```

## Lifetime follows tree position

Because listeners attach on mount and detach on unmount, placing one inside a branch scopes it to that branch. No manual `addEventListener`/`removeEventListener` bookkeeping:

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

- Handlers use the same `on` + capitalized name convention as elements, typed against `WindowEventMap` / `DocumentEventMap`. `onResize`, `onScroll`, `onKeydown`, `onVisibilitychange`, `onPopstate`, and so on.
- Append `Capture` to listen in the capture phase, like `onMousedownCapture` or `onFocusinCapture`.
- A handler can be a `Readable` of a function and the listener is swapped when it changes.
- `event.target` is not narrowed to the global object. For a document `keydown` it is whatever element had focus, just like in the browser.

You now have every building block. The final part assembles them into a real application, starting with the [router](/docs/router).
