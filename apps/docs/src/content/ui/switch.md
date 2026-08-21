---
title: Switch
description: An on/off control that takes effect the moment it is flipped.
section: Components
---

<div data-demo="switch" data-demo-description="Three labeled switches: Airplane mode off, Marketing emails on, and a Disabled switch stuck on."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/switch
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/switch.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too.

<div data-source="switch"></div>

<div data-tabs-end></div>

## Usage

A switch is for a setting that applies immediately. When the change only lands on submit, use a [checkbox](/ui/checkbox).

The root renders a `SwitchThumb` for you unless you pass children — the thumb is exported for when you want a different one.

```ts
import { signal } from "@implementjs/core";
import { Switch } from "@/lib/components/ui/switch";

const airplaneMode = signal(false);

Switch({ id: "airplane", checked: airplaneMode });
```

## With a label

```ts
Div(
	{ class: "flex items-center gap-2" },
	Switch({ id: "airplane" }),
	Label({ for: "airplane", class: "text-sm font-medium" }, "Airplane mode"),
);
```

## API Reference

Every prop the styling does not consume is forwarded to the [Switch primitive](/primitives/docs/switch), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-switch"></div>
