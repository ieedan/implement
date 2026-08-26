---
"@implementjs/kit": patch
"@implementjs/router": patch
---

Links the router follows preload their route's code and data before they are followed.

A navigation already resolved the destination's chunks and its `__data.json` before committing — the click just paid for both. It now usually pays for neither: the pointer arriving over a link (or focus landing on it) starts the same two fetches a couple of hundred milliseconds early, and the navigation spends what is waiting instead of asking again.

The default applies to `router.Link` and nothing else, which is narrower than it might look and deliberate. This framework routes a `Link` click and leaves every other `<a>` to the browser, so a plain `<a href="/somewhere">` is a full document load — a chunk or a payload warmed for one is thrown away the moment it is followed. `@implementjs/router` now marks its own anchors with `data-implement-link` (exported as `ROUTED_LINK_ATTRIBUTE`) to say the click stays in the page, and that marker is what the default follows.

The behaviour is otherwise declared in markup rather than wired per link. Any element may carry `data-implement-preload-data` (`"hover"`, `"tap"`, `"off"`) or `data-implement-preload-code` (`"eager"`, `"viewport"`, `"hover"`, `"tap"`, `"off"`), and links beneath it take the nearest one — so a subtree whose loads are expensive enough that a passing pointer should not run one holds them back to the press without touching the links themselves. A named attribute is honoured on any link, routed or not, which is how an app that routes a link its own way opts in. `kit({ preload })` sets what a routed link inherits when nothing above it says otherwise. Only code offers `"eager"` and `"viewport"`: a chunk is immutable and cached for the life of the page, while a load result goes stale, and prefetching every one in the viewport would be a way to serve the reader yesterday's data.

`@implementjs/kit/navigation` is a new entry exporting `preloadCode(...hrefs)` and `preloadData(href)`, for the navigations markup cannot predict — a wizard warming its next step, a row that opens on double click. A preloaded payload waits rather than being applied (seeding it would re-render the page the reader is still on), is spent by the next navigation to that route, and is dropped after 30 seconds unspent, so preloading stays a speed change rather than a caching layer.

Nothing is preloaded speculatively while `navigator.connection.saveData` is set, and links the browser owns are left alone throughout: another origin, `target="_blank"`, `download`, `rel="external"`, `mailto:`, a bare fragment, or a link back to the page already on screen.
