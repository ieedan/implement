# @implementjs/router

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
