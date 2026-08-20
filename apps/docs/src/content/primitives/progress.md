---
title: Progress
description: Show how far a task has advanced toward completion.
section: Components
---

<div data-demo="progress" data-demo-description="An “Uploading photos” progress bar that animates from 13% toward 100% on a timer, with the percentage rendered beside the label."></div>

A progress bar shows the completion status of a task — a file upload, an installation, a multi-step form. `Progress` renders a `Div` with `role="progressbar"` and the aria value attributes; you draw the track and the fill.

```ts
import { Progress } from "@implementjs/primitives";

Progress({ value: 40, "aria-label": "Uploading" });
```

It takes a props object like the [element factories](/docs/elements), and extra props are forwarded onto the underlying `Div`.

A progress bar's value only ever advances toward completion. For a measurement that can move in either direction — CPU usage, battery level — use [Meter](/primitives/docs/meter) instead; assistive technology announces the two differently.

## Value and range

`value` defaults to `0` inside a range from `min` (`0`) to `max` (`100`). Pass numbers to seed them, or a [signal](/docs/signals) to control them from outside (`signal()` returns a writable unchanged, so the same prop accepts both):

```ts
const uploaded = signal(0);

Progress({ value: uploaded, "aria-label": "Uploading" });

uploaded.set(40); // the aria and data attributes follow
```

## Indeterminate

When you cannot know how far along the task is, pass `null`. The bar drops `aria-valuenow`, sets `data-state="indeterminate"`, and adds a bare `data-indeterminate` attribute for styling:

```ts
Progress({ value: null, "aria-label": "Loading" });
```

A signal holding `number | null` can move between the two — start indeterminate while a size is unknown, then switch to real values.

## Accessibility

The primitive sets `role="progressbar"`, `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` (omitted while indeterminate). Two things are left to you:

- **A name.** If there is a visible label, point `aria-labelledby` at its `id`; otherwise pass `aria-label`.
- **A readable value.** Screen readers often announce `aria-valuenow` as a percentage. When a percentage is not how a person would say the value, pass `aria-valuetext` — an installer might use `"step 2 of 5"`.

```ts
(Span({ id: "install-label" }, "Installing"),
	Progress({
		"aria-labelledby": "install-label",
		"aria-valuetext": "step 2 of 5",
		value: 2,
		max: 5,
	}));
```

## Styling

The primitive is invisible until you style it — it has no default size or color. Style the root as the track and put your own fill inside it. `data-value`, `data-min`, and `data-max` are on the root for CSS to react to, and `data-state` moves through `"loading"`, `"loaded"`, and `"indeterminate"`:

```ts
const uploaded = signal(40);

Progress(
	{
		value: uploaded,
		"aria-label": "Uploading",
		class: "h-2 w-56 overflow-hidden rounded-full bg-muted data-[state=loaded]:opacity-50",
	},
	Div({
		class: "h-full bg-primary transition-[width]",
		style: { width: uploaded.bind((v) => `${v}%`) },
	}),
);
```

`data-indeterminate` is present only while the value is `null`, so one selector can swap the fill for a looping animation: `data-indeterminate:animate-pulse` on the root, or `group-data-[indeterminate]:animate-slide` on the fill.

## API Reference

<div data-api="progress"></div>
