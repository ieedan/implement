# @implementjs/core

## 0.0.3

### Patch Changes

- [`c4cdbfd`](https://github.com/ieedan/implement/commit/c4cdbfd9590eda1e8df1ae1c3c241c98cd6b8b15) Thanks [@ieedan](https://github.com/ieedan)! - Serialize `Portal` output after the app tree so hydration can claim the server
  markup.

  The server render mounted into `document.body`, which is also where `Portal`
  sends its children, so portal output landed wherever the portal happened to
  mount — for a toaster in a root layout, ahead of the rest of the page. The
  client mounts its portals into the real `document.body`, outside the `[data-ssr]`
  wrapper, so its claim cursor met the portal's markup where it expected the
  page's own and failed the pass, discarding the server render and remounting the
  whole tree. The render now mounts into a wrapper inside the server body, the way
  the client mounts into the injected `[data-ssr]` wrapper, so portal output
  serializes past the end of the app tree, where the leftover sweep removes it.

## 0.0.2

### Patch Changes

- [#33](https://github.com/ieedan/implement/pull/33) [`aee1296`](https://github.com/ieedan/implement/commit/aee129639e5d4f04d3285c017c42fa3649fab48b) Thanks [@ieedan](https://github.com/ieedan)! - Clear a list with one range deletion instead of one removal per row. `ForEach` emptying ten thousand rows made ten thousand `removeChild` calls; the rows are contiguous, so one range deletion takes them all. Partial removals are unaffected.

## 0.0.1

### Patch Changes

- [`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed) Thanks [@ieedan](https://github.com/ieedan)! - initial setup

- [`6629993`](https://github.com/ieedan/implement/commit/662999342363fb2bbdf37966bb0530c1d084f375) Thanks [@ieedan](https://github.com/ieedan)! - Drop the `Html`, `Head`, `Body`, `Base` and `Noscript` element factories.

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
