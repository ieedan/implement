# @implementjs/router

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
