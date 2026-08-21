---
title: Progress
description: How far along a task is, or that it is running at all.
section: Components
---

<div data-demo="progress" data-demo-description="An “Uploading photos” progress bar that animates from 13% toward 100% on a timer, with the percentage rendered beside the label."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/progress
```

Nothing else comes with it — this one stands alone on `@implementjs/core` and `@implementjs/primitives`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/progress.ts`.

<div data-source="progress"></div>

<div data-tabs-end></div>

## Usage

A task that starts and finishes: an upload, an import, a build. For a standing measurement, use [meter](/ui/meter).

The wrapper renders the indicator and drives it from `value`, `min`, and `max`. Pass `value: null` for a task whose length is unknown — the bar fills and pulses instead of showing a position.

```ts
import { signal } from "@implementjs/core";
import { Progress } from "@/lib/components/ui/progress";

const value = signal(13);

Progress({ value, "aria-label": "Uploading photos" });
```

## Indeterminate

```ts
Progress({ value: null, "aria-label": "Importing" });
```

The primitive sets `data-indeterminate` on the root, and the indicator animates on it. `motion-reduce` is respected through Tailwind's own variant on the transition.

## API Reference

Every prop the styling does not consume is forwarded to the [Progress primitive](/primitives/docs/progress), so the tables below are the whole surface — the behavior props and the styling ones together.

<div data-api="ui-progress"></div>
