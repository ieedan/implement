# @implementjs/router

## 0.0.12

### Patch Changes

- Updated dependencies [[`dee038d`](https://github.com/ieedan/implement/commit/dee038d6cfab50e818a237e002f1d97a1e9a93d3)]:
  - @implementjs/core@0.0.10

## 0.0.11

### Patch Changes

- [#75](https://github.com/ieedan/implement/pull/75) [`acc73c7`](https://github.com/ieedan/implement/commit/acc73c732c927585a7064f4805cd08a1f625f6fc) Thanks [@ieedan](https://github.com/ieedan)! - `navigate` and `href` take params the way `Link` does — under a `params` key, signals included.

  `navigate("/issues/:id", { params: { id }, replace: true })` is now the shape, so the object behind a `Link` carries over to the `onSelect: () => navigate(...)` it becomes, unchanged. A `Readable` param is allowed everywhere a param is: `Link` tracks it and rewrites its `href`, while `navigate` and `href` read it at call time, which is what a one-shot navigation and a plain string can do. Both keep accepting params positionally — `navigate(path, params, options)` and `href(path, params)` — so nothing has to move; the positional `navigate` is marked deprecated in its doc comment.

- [`a8d5286`](https://github.com/ieedan/implement/commit/a8d528668fb5ac32d63d9e36fad3a81a632e04c5) Thanks [@ieedan](https://github.com/ieedan)! - Links the router follows preload their route's code and data before they are followed.

  A navigation already resolved the destination's chunks and its `__data.json` before committing — the click just paid for both. It now usually pays for neither: the pointer arriving over a link (or focus landing on it) starts the same two fetches a couple of hundred milliseconds early, and the navigation spends what is waiting instead of asking again.

  The default applies to `router.Link` and nothing else, which is narrower than it might look and deliberate. This framework routes a `Link` click and leaves every other `<a>` to the browser, so a plain `<a href="/somewhere">` is a full document load — a chunk or a payload warmed for one is thrown away the moment it is followed. `@implementjs/router` now marks its own anchors with `data-implement-link` (exported as `ROUTED_LINK_ATTRIBUTE`) to say the click stays in the page, and that marker is what the default follows.

  The behaviour is otherwise declared in markup rather than wired per link. Any element may carry `data-implement-preload-data` (`"hover"`, `"tap"`, `"off"`) or `data-implement-preload-code` (`"eager"`, `"viewport"`, `"hover"`, `"tap"`, `"off"`), and links beneath it take the nearest one — so a subtree whose loads are expensive enough that a passing pointer should not run one holds them back to the press without touching the links themselves. A named attribute is honoured on any link, routed or not, which is how an app that routes a link its own way opts in. `kit({ preload })` sets what a routed link inherits when nothing above it says otherwise. Only code offers `"eager"` and `"viewport"`: a chunk is immutable and cached for the life of the page, while a load result goes stale, and prefetching every one in the viewport would be a way to serve the reader yesterday's data.

  `@implementjs/kit/navigation` is a new entry exporting `preloadCode(...hrefs)` and `preloadData(href)`, for the navigations markup cannot predict — a wizard warming its next step, a row that opens on double click. A preloaded payload waits rather than being applied (seeding it would re-render the page the reader is still on), is spent by the next navigation to that route, and is dropped after 30 seconds unspent, so preloading stays a speed change rather than a caching layer.

  Nothing is preloaded speculatively while `navigator.connection.saveData` is set, and links the browser owns are left alone throughout: another origin, `target="_blank"`, `download`, `rel="external"`, `mailto:`, a bare fragment, or a link back to the page already on screen.

- Updated dependencies [[`88c4745`](https://github.com/ieedan/implement/commit/88c4745c2e9bdc1819abe112200f8bb05804c0af)]:
  - @implementjs/core@0.0.9

## 0.0.10

### Patch Changes

- [#73](https://github.com/ieedan/implement/pull/73) [`090e305`](https://github.com/ieedan/implement/commit/090e305ad38d9c299ea20b99ff2a77bba0754cd3) Thanks [@ieedan](https://github.com/ieedan)! - Hot updates re-render one level of the route instead of remounting the app.

  Every `page.ts` and `layout.ts` now accepts its own updates in dev, and the generated client entry no longer accepts anything. An edit stops at the route file that renders it: kit swaps the component behind that route's module handle and asks the router to rebuild from that file's position in the layout chain, so the layouts above it stay mounted with their DOM, their subscriptions, their state, and the reader's scroll position. A file that is not itself a route lands on the route files that import it; anything that reaches no route file reloads the page, which is also what a `server.ts`, `page.server.ts`, `layout.server.ts` or `hooks.server.ts` edit now does rather than leaving the page on data the edit replaced.

  `@implementjs/router` gains `refreshRouters(depthFor)`, the seam kit drives for this. A route module's handle is also now declared once per module id rather than replaced on every re-declaration: the generated router module re-evaluates whenever anything it imports does — a view importing `router` for a `Link` puts it back in the chain of its own update — and a second handle stranded the route table the mounted router was built from.

## 0.0.9

### Patch Changes

- Updated dependencies [[`0ac0208`](https://github.com/ieedan/implement/commit/0ac0208d825804969a58c61fb21063724a10e431)]:
  - @implementjs/core@0.0.8

## 0.0.8

### Patch Changes

- Updated dependencies [[`5077090`](https://github.com/ieedan/implement/commit/50770900102e0dafbccbf187054ed2cdfcdcefa5)]:
  - @implementjs/core@0.0.7

## 0.0.7

### Patch Changes

- Updated dependencies [[`00239de`](https://github.com/ieedan/implement/commit/00239de0e84fe27b2f8737e977d973b4d24c454e)]:
  - @implementjs/core@0.0.6

## 0.0.6

### Patch Changes

- Updated dependencies [[`f60114f`](https://github.com/ieedan/implement/commit/f60114f329cd73c5922a60c8337566afa97d3f21)]:
  - @implementjs/core@0.0.5

## 0.0.5

### Patch Changes

- Updated dependencies [[`14ce276`](https://github.com/ieedan/implement/commit/14ce276cf1a03340930ae030410551d23efa724e)]:
  - @implementjs/core@0.0.4

## 0.0.4

### Patch Changes

- Updated dependencies [[`c4cdbfd`](https://github.com/ieedan/implement/commit/c4cdbfd9590eda1e8df1ae1c3c241c98cd6b8b15)]:
  - @implementjs/core@0.0.3

## 0.0.3

### Patch Changes

- [#40](https://github.com/ieedan/implement/pull/40) [`96c8eb9`](https://github.com/ieedan/implement/commit/96c8eb97aa3a1c5fe234f1c5ab068411476f5cdb) Thanks [@ieedan](https://github.com/ieedan)! - `:param=<name>` segments, gated by a matcher. `Router(routes, { matchers })`
  takes the matchers a tree's keys name; a matcher either turns a segment down —
  so matching carries on to the next route — or answers with the value the param
  carries, which need not be a string. A matched param outranks a plain one at
  the same position, and a key naming a matcher the router was not given throws
  when the router is built.

  Declare what a matcher produces in the new `ParamTypes` registry and the params
  are typed through it:

  ```ts
  declare module "@implementjs/router" {
  	interface ParamTypes {
  		integer: number;
  	}
  }

  Router({ "/issues/:id=integer": ({ id }) => Issue(id) }, { matchers: { integer } });
  //                                           ^? Readable<number>
  ```

## 0.0.2

### Patch Changes

- Updated dependencies [[`aee1296`](https://github.com/ieedan/implement/commit/aee129639e5d4f04d3285c017c42fa3649fab48b)]:
  - @implementjs/core@0.0.2

## 0.0.1

### Patch Changes

- [#32](https://github.com/ieedan/implement/pull/32) [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66) Thanks [@ieedan](https://github.com/ieedan)! - Publish the node-authoring API and extract the router.

  `@implementjs/core` gains `Outlet`, a swappable mount region whose children are mounted
  through core — so context lookups, error boundaries, hydration and server rendering all
  work inside one — and `location`, the current `RouterLocation` as a `Readable`. Core also
  restores the scroll position of the entry a reload landed on off the first location
  subscription, so a hand-written router gets that for free.

  `Router` moves to the new `@implementjs/router`, written against that public API and
  nothing else. `@implementjs/core/router` is gone; navigation stays in core (`location`,
  `navigateTo`, `searchParam`, the navigation guards and the resolver).

  kit generates `import { Router } from "@implementjs/router"` and takes it as a dependency,
  and scaffolded kit apps list it too — generated code resolves from the app, not from kit.

- Updated dependencies [[`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed), [`6629993`](https://github.com/ieedan/implement/commit/662999342363fb2bbdf37966bb0530c1d084f375), [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66)]:
  - @implementjs/core@0.0.1
