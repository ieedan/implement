---
title: Label
description: A label for a control.
section: Components
---

<div data-demo="label" data-demo-description="An email field with its label above it, and a checkbox with its label beside it."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/label
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/label.ts`.

<div data-source="label"></div>

<div data-tabs-end></div>

## Usage

```ts
import { Label } from "@/lib/components/ui/label";

Label({ for: "email" }, "Email");
Input({ id: "email", type: "email" });
```

The primitives render buttons rather than `input`s, so `for` and `id` are how a label pairs with a [checkbox](/ui/checkbox), a [switch](/ui/switch), or a [radio group](/ui/radio-group) item — the same as with a real input.

## Disabled controls

A label dims with its control in two ways, so it works whichever way the markup is arranged:

- `peer-disabled:` — for a control marked `peer` that is a sibling of the label.
- `group-data-[disabled=true]:` — for a wrapper marked `group`, which is what [field](/ui/field) uses.

Neither needs the label to be told anything.

## Inside a field

[Field](/ui/field) has `FieldLabel`, which wraps this one and adds the layout for a label with a whole control nested inside it. Use `Label` on its own for a plain label; reach for `FieldLabel` once the form has hints and errors to arrange.

## API Reference

<div data-api="ui-label"></div>
