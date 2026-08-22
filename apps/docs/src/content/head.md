---
title: Document Head
description: Manage the title and head tags from anywhere in the tree, scoped to mount lifetime.
section: The document
order: 18
---

`ImplementHead` renders head-only elements into `document.head`. The tags live there **for as long as the node is mounted**, so lifetime follows tree position. Put one in a route's page and the tags swap on navigation. Put one inside `If(open).Then(...)` and they exist while the branch shows.

```ts
import { ImplementHead } from "@implementjs/core";

function IssuePage(issue: Readable<Issue>) {
	return Article(
		ImplementHead(
			ImplementHead.Title(issue.bind((i) => `${i.name} — Tracker`)),
			ImplementHead.Meta({ name: "description", content: issue.bind("description") }),
		),
		// … page content
	);
}
```

## The pieces

Only the branded components under `ImplementHead` may slot into it, and they fit nowhere else, so head elements can't leak into the body. The type system enforces both directions.

### Title

`ImplementHead.Title(text)` sets `document.title` (rather than appending a second `<title>` the browser would ignore). It accepts a string or a `Readable<string>` and tracks changes. On unmount the title is not restored, the next mounted `Title` wins.

### Meta and Link

```ts
ImplementHead.Meta({ name: "description", content: description });
ImplementHead.Meta({ property: "og:title", content: title }); // RDFa via `property`
ImplementHead.Link({ rel: "canonical", href: canonicalUrl });
ImplementHead.Link({ rel: "icon", href: favicon });
```

All attributes are typed and bindable, just like any element props.

### Script and Style

Content is the second argument for `Script` and the first for `Style` (not a child):

```ts
ImplementHead.Script({ src: "https://example.com/widget.js", defer: true });
ImplementHead.Script({ type: "application/ld+json" }, jsonLd);
ImplementHead.Style(`.tooltip { position: fixed; }`);
```

Inline script content executes on mount. A readable content updates the text node, but browsers never re-execute a script, so reactive content is only useful for non-executing types like `application/ld+json`.

## Nesting and precedence

Multiple `ImplementHead`s can be mounted at once (a layout's defaults plus a page's specifics). `Meta`/`Link`/`Script`/`Style` tags simply coexist in the head. For `Title`, the most recently mounted one wins.

The same mount-scoped idea applies to one more global surface: [window and document events](/docs/global-events).
