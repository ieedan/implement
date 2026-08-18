---
title: Document Head
description: Manage the title and head tags from anywhere in the tree, scoped to mount lifetime.
order: 18
---

`Implement.Head` renders head-only elements into `document.head`. The tags live there **for as long as the node is mounted**, so lifetime follows tree position: put one in a route's page and the tags swap on navigation; put one inside `If(open).Then(...)` and they exist while the branch shows.

```ts
import { Implement } from "@implementjs/core";

function IssuePage(issue: Readable<Issue>) {
	return Article(
		Implement.Head(
			Implement.Head.Title(issue.bind((i) => `${i.name} — Tracker`)),
			Implement.Head.Meta({ name: "description", content: issue.bind("description") }),
		),
		// … page content
	);
}
```

## The pieces

Only the branded components under `Implement.Head` may slot into it — and they fit nowhere else, so head elements can't leak into the body (the type system enforces both directions).

### Title

`Implement.Head.Title(text)` sets `document.title` (rather than appending a second `<title>` the browser would ignore). It accepts a string or a `Readable<string>` and tracks changes. On unmount the title is not restored — the next mounted `Title` wins.

### Meta and Link

```ts
Implement.Head.Meta({ name: "description", content: description });
Implement.Head.Meta({ property: "og:title", content: title }); // RDFa via `property`
Implement.Head.Link({ rel: "canonical", href: canonicalUrl });
Implement.Head.Link({ rel: "icon", href: favicon });
```

All attributes are typed and bindable, like any element props.

### Script and Style

Content is the second argument for `Script` and the first for `Style` (not a child):

```ts
Implement.Head.Script({ src: "https://example.com/widget.js", defer: true });
Implement.Head.Script({ type: "application/ld+json" }, jsonLd);
Implement.Head.Style(`.tooltip { position: fixed; }`);
```

Inline script content executes on mount. A readable content updates the text node, but browsers never re-execute a script — so reactive content is only useful for non-executing types like `application/ld+json`.

## Nesting and precedence

Multiple `Implement.Head`s can be mounted at once (a layout's defaults plus a page's specifics). `Meta`/`Link`/`Script`/`Style` tags simply coexist in the head; for `Title`, the most recently mounted one wins.
