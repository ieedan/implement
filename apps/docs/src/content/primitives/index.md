---
title: Introduction
description: Unstyled, composable building blocks for common UI patterns.
section: Start Here
order: 1
---

`@implementjs/core` is the framework. `@implementjs/primitives` is a small library of unstyled components built on top of it. They own the behavior (open and close, shared state, the DOM hooks you style against) and leave the look to you.

```ts
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@implementjs/primitives";
```

Add it next to core:

```sh
npm install @implementjs/core @implementjs/primitives
```

The [REPL](/repl) and tutorial playgrounds resolve `@implementjs/primitives` the same way they resolve core, so you can try a primitive without scaffolding an app.

## What you get

Each primitive is a set of functions that compose the way [components](/docs/components) always do. A root provides [context](/docs/context), parts consume it, and `data-*` attributes on the DOM are the styling hooks. Primitives are wrapped with [createComponent](/primitives/docs/create-component), so props are optional and you can pass children first when you do not need attributes.

They are deliberately unstyled. No classes, no CSS, no design tokens. You pass `class` (and any other element props) through like you would on `Div` or `Button`.

Start with [Accordion](/primitives/docs/accordion).
