# @implementjs/kit

## 0.0.3

### Patch Changes

- [#40](https://github.com/ieedan/implement/pull/40) [`96c8eb9`](https://github.com/ieedan/implement/commit/96c8eb97aa3a1c5fe234f1c5ab068411476f5cdb) Thanks [@ieedan](https://github.com/ieedan)! - Route param matchers, with the type they produce. A `src/params/<name>.ts`
  default-exports a `matcher()`, and a `[id=<name>]` route directory names it: a
  segment the matcher turns down is not a match, so the path falls through to the
  next route and reaches the error page rather than a handler that has to check
  for itself.

  A matcher may also _parse_ the segment, and what it returns is what the param is
  everywhere downstream — `event.params` in a load or a `server.ts` handler,
  `params` in a page or layout, the generated client. The generated `./$types`
  read the type off the matcher module, so it is declared once:

  ```ts
  // src/params/integer.ts
  import { matcher, mismatch } from "@implementjs/kit/params";

  export default matcher((value) => {
  	const parsed = Number(value);
  	return /^\d+$/.test(value) ? parsed : mismatch;
  });
  ```

  ```ts
  // src/routes/posts/[id=integer]/server.ts
  export const GET = handler({ handle: ({ params }) => db.post(params.id) });
  //                                                          ^? number
  ```

  `matcher()` takes a pattern (anchored to the whole segment), a parse function, or
  a Standard Schema. Matchers live in `src/params` by default — `kit({ params })`
  moves them.

- Updated dependencies [[`96c8eb9`](https://github.com/ieedan/implement/commit/96c8eb97aa3a1c5fe234f1c5ab068411476f5cdb)]:
  - @implementjs/router@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [[`aee1296`](https://github.com/ieedan/implement/commit/aee129639e5d4f04d3285c017c42fa3649fab48b)]:
  - @implementjs/core@0.0.2
  - @implementjs/router@0.0.2

## 0.0.1

### Patch Changes

- [`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed) Thanks [@ieedan](https://github.com/ieedan)! - initial setup

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
  - @implementjs/vite@0.0.1
  - @implementjs/router@0.0.1
