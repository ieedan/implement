---
title: Open Graph Images
description: Generate social share images from implement components, one per page, at build time.
section: Guides
order: 18
---

A link to your site is a card in someone else's feed, and the image on it is generated or it is nothing. `@implementjs/kit/og` renders one from ordinary implement components — the same `Div`, the same `style` prop — and hands back a `Response`.

The api is [`@vercel/og`](https://vercel.com/docs/og-image-generation)'s: same constructor, same options, same defaults. What differs is the first argument, which is components rather than JSX.

```ts
// src/routes/blog/[slug]/.png/server.ts
import { Div, ImageResponse, Span } from "@implementjs/kit/og";
import { getPost } from "@/lib/posts";
import type { RequestEvent } from "./$types";

export function GET({ params }: RequestEvent): Response {
	const post = getPost(params.slug);
	return new ImageResponse(
		Div(
			{
				style: {
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					width: "100%",
					height: "100%",
					padding: 72,
					background: "#000",
					color: "#fff",
				},
			},
			Span({ style: { fontSize: 68 } }, post.title),
			Span({ style: { fontSize: 30, color: "#a1a1a1" } }, post.description),
		),
		{ width: 1200, height: 630 },
	);
}
```

That route serves `/blog/<slug>.png`. Nothing about it is special-cased: it is an [extension route](/kit/server-routes), so the build writes one image per post next to the page it belongs to, derived from the pages that prerendered.

Point the page at it, absolutely — a crawler has no base url to resolve against:

```ts
ImplementHead(
	ImplementHead.Meta({ property: "og:image", content: `https://example.com${post.permalink}.png` }),
	ImplementHead.Meta({ property: "og:image:width", content: "1200" }),
	ImplementHead.Meta({ property: "og:image:height", content: "630" }),
	ImplementHead.Meta({ name: "twitter:card", content: "summary_large_image" }),
);
```

## Satori lays out a flexbox subset, not css

The renderer underneath is [satori](https://github.com/vercel/satori), which never sees a stylesheet and implements a fraction of css. Three rules cover most of what surprises people:

- **`class` does nothing.** Style with the `style` prop, or with `tw`.
- **An element with more than one child needs an explicit `display: "flex"`.** Satori errors rather than guessing a default.
- **A bare number is px.** `{ fontSize: 64 }` means 64px, as it does in React. Only the properties that are genuinely unitless — `lineHeight`, `flexGrow`, `opacity` — keep the number as written.

The elements exported from `@implementjs/kit/og` are core's, retyped: they accept numbers in `style`, and they accept `tw`. Import them instead of `@implementjs/core/elements` in an image route.

```ts
Div({ tw: "flex flex-col p-16", style: { background: "#000" } }, Span({ tw: "text-6xl" }, "Hello"));
```

`tw` is satori's own Tailwind implementation, resolved against its own (Tailwind v3-shaped) config rather than your app's stylesheet. Utilities work; a class naming one of your theme tokens resolves to nothing unless you pass a `tailwindConfig`.

## Fonts

Satori has no system fonts — it never touches the host — so text needs a font file passed to it. Leave `fonts` out and kit uses the Inter subset it vendors, which covers latin and nothing else.

Pass your own the way vercel's examples do, in the route file:

```ts
import inter from "./Inter-SemiBold.woff?inline";

const font = fetch(inter).then((response) => response.arrayBuffer());

export async function GET(): Promise<Response> {
	return new ImageResponse(Card(), {
		fonts: [{ name: "Inter", data: await font, weight: 600, style: "normal" }],
	});
}
```

`?inline` rather than vercel's `new URL("./font.ttf", import.meta.url)`: Vite hands back a data url, which `fetch` reads on any host, where the url form needs a file server the build does not have. ttf, otf, and woff all load; woff2 does not.

## Options

Everything `@vercel/og` takes, plus whatever `ResponseInit` accepts — `status` and `headers` pass straight through, and a `cache-control` you set wins over the immutable one kit adds.

| Option             | Default            | Notes                                                                                                          |
| ------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `width` / `height` | `1200` / `630`     | The size every platform crops against.                                                                         |
| `fonts`            | the vendored Inter | ttf, otf, or woff files as bytes.                                                                              |
| `emoji`            | —                  | `"twemoji"`, `"noto"`, … **Fetches from a cdn while rendering**, so a build that uses it is no longer offline. |
| `tailwindConfig`   | —                  | A Tailwind v3-shaped theme for `tw`.                                                                           |
| `debug`            | `false`            | Satori's layout overlay.                                                                                       |
| `format`           | `"png"`            | `"svg"` renders faster and no platform accepts it — for debugging.                                             |

## Where the image is rendered

An image route is a route, so [prerendering](/kit/ssr-and-prerendering) decides when it runs. Prerendered, it is a file on the cdn and costs the build a few hundred milliseconds per image. With `export const prerender = false` it is rendered per request, which is what a page whose title is not known at build time needs — set a `cache-control` when you do.

One caveat on the per-request path today: the rasterizer is a native addon, so it loads on a host with its own `node_modules` — `@implementjs/adapter-node`, or a long-running server — and not inside a bundled function or a worker. Prerendered images have no such limit, since they are rendered by the build and never by the host.
