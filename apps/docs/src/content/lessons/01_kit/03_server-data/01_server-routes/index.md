---
title: Server routes
description: A server.ts serves raw responses — and .md gives a page a markdown twin.
section: Server data
focus: src/routes/about/.md/server.ts
---

Not every URL is a page. A `server.ts` in a route directory is an **endpoint**: it exports a handler per HTTP method and returns a web-standard `Response` — JSON, markdown, anything:

```ts
// src/routes/api/status/server.ts
export function GET() {
	return Response.json({ ok: true });
}
```

There's a twist that makes endpoints pair beautifully with pages. A directory named `.md` (or any `.<ext>`) holding a `server.ts` serves its **parent's path with the extension appended**:

```
src/routes
    about
        index.ts        -> /about        (the page)
        .md
            server.ts   -> /about.md     (its markdown twin)
```

Same address, two representations — a rendered page for people, plain markdown for tools and LLMs. The docs site you're reading does exactly this: the **Copy Page** button on every docs page fetches that page's URL plus `.md`.

> [!NOTE]
> In a real kit app endpoints run on the server, and the build prerenders every `GET` endpoint into a static file. The playground runs the handler in the preview and shows the raw response the way a browser would.

## Your task

The about page links to its markdown twin, but the endpoint behind `/about.md` still returns `TODO`.

1. In `src/routes/about/.md/server.ts`, make `GET` return a `Response` whose body is the about page as markdown — a `# About this site` heading and a sentence or two. Keep the `content-type: text/markdown` header.

You're done when clicking **View as Markdown** on `/about` shows your raw markdown in the preview with `/about.md` in the URL bar — and the back link there is gone, because you're looking at a response, not a page.
