---
title: Breadcrumb
description: The trail back up from where you are.
section: Components
---

<div data-demo="breadcrumb" data-demo-description="A four-level trail — Docs, an ellipsis for collapsed levels, UI, and the current page — separated by chevrons."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/breadcrumb
```

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/breadcrumb.ts`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="breadcrumb"></div>

<div data-tabs-end></div>

## Usage

```ts
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/lib/components/ui/breadcrumb";

Breadcrumb(
	BreadcrumbList(
		BreadcrumbItem(BreadcrumbLink({ href: "/docs" }, "Docs")),
		BreadcrumbSeparator(),
		BreadcrumbItem(BreadcrumbPage("Breadcrumb")),
	),
);
```

## The last crumb

The page you are on is a `BreadcrumbPage`, not a `BreadcrumbLink` — you do not link to where you already are. It carries `aria-current="page"`, which is what tells a screen reader the trail has ended.

## Separators

`BreadcrumbSeparator` is `aria-hidden` and presentational. The ordered list already says these are steps, so announcing "chevron right" between each pair would only be noise. Pass children to use a different mark:

```ts
BreadcrumbSeparator(SlashIcon());
```

## Collapsing a long trail

`BreadcrumbEllipsis` stands in for levels you have dropped. On a deep tree, wrap it in a [dropdown menu](/ui/dropdown-menu) so the hidden levels are still reachable.

## API Reference

<div data-api="ui-breadcrumb"></div>
