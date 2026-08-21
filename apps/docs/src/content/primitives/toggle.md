---
title: Toggle
description: A two-state button that can be on or off.
section: Components
---

<div data-demo="toggle"></div>

A toggle is a button that stays pressed — bold in a text editor, a mute button, a filter chip. `Toggle` renders a `Button` with `aria-pressed`; you give it a look and children, it handles the state.

```ts
import { Toggle } from "@implementjs/primitives";

Toggle({ "aria-label": "Toggle bold" }, BoldIcon({ "aria-hidden": true }));
```

It accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Button`.

A toggle is not a checkbox: `aria-pressed` announces as "toggle button, pressed" while a checkbox announces as "checked", and screen reader users expect a toggle to act immediately rather than mark a choice in a form. For a form choice, use [Checkbox](/primitives/docs/checkbox); for an on/off setting, consider a switch.

## Pressed state

`Toggle` owns whether it is pressed. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const bold = signal(false);

Toggle({ pressed: bold, "aria-label": "Toggle bold" }, BoldIcon({ "aria-hidden": true }));

bold.set(true); // presses it from outside
```

Clicking toggles the signal, so whatever you wired it to follows.

## Disabled

Pass `disabled` to prevent toggling. It sets the native `disabled` attribute plus a `data-disabled` attribute for styling, and also accepts a signal:

```ts
Toggle(
	{ disabled: true, "aria-label": "Toggle underline" },
	UnderlineIcon({ "aria-hidden": true }),
);
```

## Accessibility

The primitive sets `aria-pressed` to `"true"` or `"false"` — that is what makes it a toggle button to assistive technology. One thing is left to you: a name. Icon-only toggles need an `aria-label` (or visible text children), and the name should describe the action, not the state — "Toggle bold", never "Bold on".

## Styling

Every toggle sets `data-toggle-root` and exposes `data-state` as `"on"` or `"off"`, plus `data-disabled` while disabled:

```ts
Toggle({
	"aria-label": "Toggle italic",
	class:
		"rounded-md p-2 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
});
```

`data-state` is there so the pressed look is pure CSS — no signal to thread through.

## API Reference

<div data-api="toggle"></div>
