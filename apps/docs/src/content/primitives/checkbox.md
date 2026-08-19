---
title: Checkbox
description: A control that toggles between checked, unchecked, and indeterminate.
section: Components
---

<div data-demo="checkbox"></div>

A checkbox is a button that turns a value on and off. `Checkbox` renders a `Button` with `role="checkbox"` and keeps `aria-checked` in sync — you give it a size, a border, and the indicator that shows inside it.

```ts
import { Checkbox } from "@implementjs/primitives";

Checkbox({});
```

It takes a props object first (even if it is empty) and then children, the same shape as the [element factories](/docs/elements). Extra props are forwarded onto the underlying `Button`.

## Checked state

`checked` defaults to `false`. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const accepted = signal(false);

Checkbox({ checked: accepted });

Button({ onClick: () => accepted.set(true) }, "Accept");
```

Clicking the checkbox toggles `checked`. Space and Enter do the same, because it is a real `Button`.

## Indeterminate

`indeterminate` is for a parent that represents a mixed set — some children on, some off. Pass a boolean or a signal. While it is true, `data-state` is `"indeterminate"` and `aria-checked` is `"mixed"`.

Clicking an indeterminate checkbox clears that flag and checks it:

```ts
const all = signal(false);
const mixed = signal(true);

Checkbox({ checked: all, indeterminate: mixed });
```

## Labels

Pair it with a `Label` whose `for` matches the checkbox `id`. Clicking the text then toggles the control, and the accessible name comes from the label instead of the indicator:

```ts
import { Label } from "@implementjs/core";

Div(
	{ class: "flex items-center gap-2" },
	Checkbox({ id: "terms" }),
	Label({ for: "terms" }, "Accept terms and conditions"),
);
```

## Styling

The primitive is unstyled until you give it a look. It sets `data-checkbox-root` and `data-state` as `"checked"`, `"unchecked"`, or `"indeterminate"`, so one class list can cover every state. Children are the indicator — typically a check icon that you show while checked, and a minus while mixed:

```ts
import { CheckIcon, MinusIcon } from "@implementjs/lucide";

Checkbox(
	{
		class:
			"size-4 rounded-[4px] border border-input data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
	},
	CheckIcon({ class: "size-3.5 hidden [[data-state=checked]_&]:block" }),
	MinusIcon({ class: "size-3.5 hidden [[data-state=indeterminate]_&]:block" }),
);
```

`data-state` is there for the fill, the icon, and anything else that should react to checked versus mixed without you threading a signal through.

## API Reference

<div data-api="checkbox"></div>
