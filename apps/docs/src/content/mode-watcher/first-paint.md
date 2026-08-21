---
title: First paint
description: The blocking script that puts the stored mode on the page before it renders.
section: Guides
order: 30
---

Applying the mode after the app mounts is too late — the page has already painted in the wrong colors. `ModeWatcher` renders a small blocking script into `<head>` that reads `localStorage`, resolves the mode, and puts the class on `<html>` before the first paint. It runs during a server render too, so the markup a [kit](/kit) app ships already carries it.

If the script has to live somewhere else — inlined into an `index.html`, or injected by a server hook — `createInitialModeExpression` returns its source, and `injectScript: false` stops the component from adding a second one:

```ts
import { createInitialModeExpression } from "@implementjs/mode-watcher";

const source = createInitialModeExpression({ defaultMode: "dark" });
```

Pass the same options you gave the manager: the script and the manager have to agree, or the page corrects itself visibly a moment after it loads. Under a Content Security Policy, `nonce` puts one on the injected script:

```ts
ModeWatcher({ manager: mode, nonce: cspNonce });
```

## What the script does

It is the smallest thing that gets `<html>` right: read the two storage keys, fall back to `defaultMode` and `defaultTheme`, resolve `"system"` against `prefers-color-scheme`, then set the classes, `color-scheme`, `data-theme`, and the `theme-color` meta tag. Everything else — following the OS as it changes, following other tabs, suppressing transitions — waits for the manager, which starts when `ModeWatcher` mounts.
