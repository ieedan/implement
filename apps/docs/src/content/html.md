---
title: Raw HTML
description: Insert trusted HTML markup as live nodes with the Html helper.
order: 16
---

`Html(markup)` parses an HTML string and inserts the resulting nodes in place. Unlike setting `innerHTML` on a parent, it inserts _siblings_ between anchors, so surrounding children are untouched:

```ts
import { Html } from "@packages/implement";

Article(H1(post.bind("title")), Div({ class: "prose" }, Html(post.get().renderedBody)));
```

## Reactive markup

Pass a `Readable<string>` and the rendered nodes are replaced whenever it changes:

```ts
const preview = derived([markdown], (md) => renderMarkdown(md));

Div({ class: "preview" }, Html(preview));
```

## Trust

The string is parsed as-is — **there is no sanitization**. Only feed `Html` markup you control or have sanitized upstream; user-provided content passed raw is an XSS. (This documentation site renders its markdown-compiled pages through `Html`.)

For SVG markup specifically, prefer [`Svg`](/docs/svg) — it caches parsed templates and gives the root element typed, bindable props.
