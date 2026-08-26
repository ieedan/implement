---
title: Preloading
description: Warm a route's code and data while the pointer is still over the link.
section: Guides
order: 13
---

A client-side navigation isn't free. Before kit swaps the page it has to have the destination's code — routes are [code-split](/kit/routing), so a page you haven't visited is a chunk you haven't downloaded — and, for a route with a [load](/kit/loading-data), its `__data.json`. Both are fetched when the click lands, and the reader watches them arrive.

They don't have to be. The pointer arriving over a link is a good guess that the click is coming, and it arrives a couple of hundred milliseconds ahead of it. Kit spends that window on the fetches, so by the time the click lands there is usually nothing left to wait for.

**This is on by default.** The rest of this page is what "this" applies to, how to turn it up or down, and how to preload things that aren't links.

## What gets preloaded

Preloading only pays off for a link whose click stays in the page. Kit's default therefore applies to exactly those, and nothing else:

- **`router.Link` — yes.** This is the case you'll hit. A `Link` renders an `<a>` carrying `data-implement-link`, which is the router saying it will handle the click itself, and that marker is what the default follows. Nothing to opt into.
- **A plain `<a href="/somewhere">` — no.** Nothing intercepts its click, so following it is a full document load: the browser throws away the page and everything warmed for it. Preloading one would spend the reader's bandwidth on a chunk and a `__data.json` that get discarded a moment later.

Both are same-origin links to a route in your app, and they look identical in the markup. The difference is entirely what happens on click, which is why the router marks its own.

If you route a link some other way — your own `onClick` calling `navigateTo`, a component that isn't `Link` — name the attribute and it's preloaded like any other:

```ts
A({ href: "/orders/1", "data-implement-preload-data": "hover", onClick: openOrder }, "Order #1");
```

An explicitly named attribute is honoured on any link. Only the unasked-for default is narrowed to routed ones. So `data-implement-preload-data="hover"` on `<body>` really does mean _every_ link, prose links included — which is usually not what you want on a page rendering markdown.

Two more things stop a preload regardless:

- **Links the browser owns.** Another origin, `target="_blank"`, `download`, `rel="external"`, `mailto:`, a bare `#fragment`, or a link back to the page already on screen.
- **`navigator.connection.saveData`.** When the reader has asked their browser to use less data, kit does no speculative preloading at all. A `preloadData()` call you write yourself is your decision and still runs.

## Turning it down per link

Any element can carry `data-implement-preload-data`, and every link beneath it inherits the setting from the nearest ancestor that sets one. So the exceptions are declared where they apply, without touching the links themselves:

```ts
import { A, Nav } from "@implementjs/core";

// this whole menu waits for the press instead of the hover
Nav({ "data-implement-preload-data": "tap" }, A({ href: "/reports/annual" }, "Annual report"), …);
```

The values:

| Value     | When the data is fetched                                                         |
| --------- | -------------------------------------------------------------------------------- |
| `"hover"` | The pointer arrives over the link, or it takes keyboard focus. The default.      |
| `"tap"`   | The pointer goes _down_ on it — still ahead of the click, just less speculative. |
| `"off"`   | Not until the navigation itself.                                                 |

Reach for `"tap"` or `"off"` when the load behind the link is expensive enough that a pointer merely crossing it shouldn't run one: a report that aggregates a quarter of rows, a search that costs money per call. On a touch device `"hover"` behaves as `"tap"` anyway — there is no pointer to arrive early.

## Code and data are separate settings

`data-implement-preload-code` governs the route's chunks on its own, and it takes two values data can't:

| Value        | When the code is fetched                          |
| ------------ | ------------------------------------------------- |
| `"eager"`    | As soon as the link is in the document.           |
| `"viewport"` | When the link scrolls into view.                  |
| `"hover"`    | The pointer arrives, or focus lands. The default. |
| `"tap"`      | The pointer goes down.                            |
| `"off"`      | Not until the navigation itself.                  |

`"eager"` and `"viewport"` are code-only on purpose. A chunk is immutable and cached for the life of the page, so fetching one early is only ever a bandwidth question. A load result goes stale — prefetching every one in the viewport would be a way to serve the reader yesterday's data.

The two settings compose. A link that preloads data on hover preloads its code with it — `preloadData` pulls the chunks in too — so the common case is one pass, not two:

```ts
// warm chunks as they scroll into view; leave the data to the press
Div(
	{ "data-implement-preload-code": "viewport", "data-implement-preload-data": "tap" },
	…rows,
);
```

## Changing the default

`preload` in `vite.config.ts` sets what a link inherits when nothing above it says otherwise:

```ts
import { kit } from "@implementjs/kit";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		kit({
			// off by default; the subtrees that want it opt in with the attribute
			preload: { data: "off", code: "viewport" },
		}),
	],
});
```

## Preloading from code

Some navigations aren't a pointer over an `<a>`: a wizard knows what step two is, a list row might open on double click, a "next" button is the only link on the page and the reader will certainly press it. `@implementjs/kit/navigation` exposes the same two operations directly.

```ts
import { preloadCode, preloadData } from "@implementjs/kit/navigation";

// everything the destination needs — its chunks and its load results
await preloadData("/checkout/payment");

// just the chunks, for a route whose data you'd rather have fresh
await preloadCode("/checkout/payment", "/checkout/confirm");
```

`preloadData(href)` resolves with the data it fetched, or `null` for a route with no load — it still preloads the code in that case. `preloadCode(...hrefs)` takes as many paths as you like. Both reject if a chunk or a fetch fails, and both are safe to ignore: the navigation itself runs the same fetches, and falls back to a full document load if they fail again.

```ts
import { onMount } from "@implementjs/core";

export default function Step1() {
	// the reader is filling in this step; step two arrives while they type
	onMount(() => void preloadData("/checkout/payment"));
	return …;
}
```

## What a preload will not do

- **Apply the data.** A preloaded payload waits; it does not reach the page. Seeding it on hover would re-render the page the reader is still looking at with some other route's data.
- **Serve a stale payload.** A payload that was not spent within 30 seconds is dropped, and the navigation fetches fresh. Preloading is a speed change, not a caching layer — the data a page renders is never older than the click that asked for it by more than that window.
- **Repeat itself.** A second hover over a link already warmed joins the first fetch rather than starting another, and a chunk loads once for the life of the page.

## See also

- [Loading Data](/kit/loading-data) — the loads whose results a preload fetches, and where `__data.json` comes from.
- [Routing](/kit/routing) — the route tree the code split follows.
- [`Router`](/docs/router) — `Link`, whose clicks are the ones a preload is for.
