---
title: Raw HTML
description: Insert trusted HTML markup as live nodes with the Html helper.
section: The document
order: 16
---

Sometimes your content arrives as an HTML string, like the output of a markdown compiler. `Html(markup)` parses an HTML string and inserts the resulting nodes in place. Unlike setting `innerHTML` on a parent, it inserts _siblings_ between anchors, so surrounding children are untouched:

```ts
import { Html } from "@implementjs/core";

Article(H1(post.bind("title")), Div({ class: "prose" }, Html(post.get().renderedBody)));
```

## Reactive markup

Pass a `Readable<string>` and the rendered nodes are replaced whenever it changes:

```ts
const preview = derived([markdown], (md) => renderMarkdown(md));

Div({ class: "preview" }, Html(preview));
```

## Trust

The string is parsed as-is, **there is no sanitization**. Only feed `Html` markup you control or have sanitized upstream. User-provided content passed raw is an XSS waiting to happen. (For what it's worth, this documentation site renders its markdown-compiled pages through `Html`.)

For SVG markup specifically, prefer [`Svg`](/docs/svg). It caches parsed templates and gives the root element typed, bindable props.
