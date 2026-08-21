---
title: Input
description: A text field.
section: Components
---

<div data-demo="input" data-demo-description="A labelled project-name field echoing what you type, plus a disabled input and one in an invalid state."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/input
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/input.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too.

<div data-source="input"></div>

<div data-tabs-end></div>

## Usage

```ts
import { Input } from "@/lib/components/ui/input";

Input({ id: "email", type: "email", placeholder: "you@example.com" });
```

Every prop goes through to the `input`, so `type`, `value`, `placeholder`, `required`, and the rest work as they always do — this only dresses it.

## Binding a value

Pass a signal as `value` to read what is typed:

```ts
const email = signal("");

Input({ id: "email", type: "email", value: email });
```

## Labels and errors

Pair it with a [label](/ui/label) by `for` and `id`, or let [field](/ui/field) arrange the label, the hint, and the error together.

`aria-invalid` is styled as well as announced — the border and focus ring turn destructive — which is how `FieldError` marks the control it belongs to.

## File inputs

`type="file"` is styled too: the `file:` variants give the button the same text and weight as the rest of the field, instead of the browser default.

## API Reference

<div data-api="ui-input"></div>
