---
title: Switch
description: A control that toggles between on and off.
section: Components
---

<div data-demo="switch" data-demo-description="Three labeled switches: Airplane mode off, Marketing emails on, and a Disabled switch stuck on."></div>

A switch is a button that turns a setting on and off. `Switch` renders a `Button` with `role="switch"` and keeps `aria-checked` in sync — you give it a track and a thumb.

```ts
import { Switch, SwitchThumb } from "@implementjs/primitives";

Switch(SwitchThumb());
```

It accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Button`.

A switch has only two states. For a control that can also be mixed, use [Checkbox](/primitives/docs/checkbox).

## Checked state

`checked` defaults to `false`. Pass a boolean to seed it, or a [signal](/docs/signals) to control it from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const enabled = signal(false);

Switch({ checked: enabled }, SwitchThumb());

Button({ onClick: () => enabled.set(true) }, "Turn on");
```

Clicking the switch toggles `checked`. Space and Enter do the same, because it is a real `Button`.

`onCheckedChange` runs on every change to `checked`, so you can react without holding a signal of your own:

```ts
Switch({ onCheckedChange: (checked) => console.log(checked) }, SwitchThumb());
```

## Thumb

`SwitchThumb` is the knob that slides. Put it inside the switch and style it against `data-state`, which is `"checked"` or `"unchecked"` on both parts:

```ts
Switch(
	{
		class: "inline-flex h-5 w-8 items-center rounded-full bg-input data-[state=checked]:bg-primary",
	},
	SwitchThumb({
		class:
			"block size-4 rounded-full bg-background transition-transform data-[state=checked]:translate-x-3.5",
	}),
);
```

## Labels

Pair it with a `Label` whose `for` matches the switch `id`. Clicking the text then toggles the control:

```ts
import { Label } from "@implementjs/core";

Div(
	{ class: "flex items-center gap-2" },
	Switch({ id: "airplane" }, SwitchThumb()),
	Label({ for: "airplane" }, "Airplane mode"),
);
```

## Forms

Pass `name` and the switch renders a visually hidden checkbox that submits with the form. The value is `"on"` while checked; pass `value` to change it. `required` and `disabled` apply to that input too:

```ts
Form(
	{ method: "post" },
	Switch({ name: "newsletter", value: "yes" }, SwitchThumb()),
	Button({ type: "submit" }, "Save"),
);
```

Without `name`, no hidden input is rendered.

## API Reference

<div data-api="switch"></div>
