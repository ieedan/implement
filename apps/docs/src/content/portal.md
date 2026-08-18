---
title: Portal
description: Mount children into another element while keeping them in the logical tree.
order: 15
---

`Portal` renders its children into a different DOM parent — `document.body` by default — escaping ancestor stacking contexts and `overflow` clipping. Dialogs, dropdowns, and toasts are the usual customers.

```ts
import { Portal } from "@implementjs/core";

If(open).Then(
	Portal(Div({ class: "fixed inset-0 grid place-items-center bg-black/50" }, DialogPanel())),
);
```

## Choosing a target

Chain `.To(target)` or use the props form; the target may be an element or a `Readable` of one (children move when it changes):

```ts
Portal(Toast(message)).To(toastRoot);

Portal({ to: overlayRoot }, DialogPanel());
```

## Disabling

`disabled` mounts the children in place (in the normal parent) instead of teleporting them — bindable, so a signal can toggle it at runtime. Useful for nested overlays that should stay inside their parent overlay:

```ts
Portal({ to: document.body, disabled: isNested }, Menu());
Portal(Menu()).Disabled(isNested);
```

## Still part of the tree

Teleporting only moves the DOM. The children keep their position in the **logical tree**, which means:

- [Context](/docs/context) lookups resolve from where the `Portal` is declared.
- Unmounting the portal (or the `If` branch around it) unmounts the teleported children.
- Errors inside the portal reach the [error boundary](/docs/boundary) wrapping the portal.
