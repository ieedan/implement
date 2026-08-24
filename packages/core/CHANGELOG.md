# @implementjs/core

## 0.0.8

### Patch Changes

- [`0ac0208`](https://github.com/ieedan/implement/commit/0ac0208d825804969a58c61fb21063724a10e431) Thanks [@ieedan](https://github.com/ieedan)! - Throw on `bind(selector, update)` against a read-only source, instead of
  silently dropping the write-back.

  The guard existed in `createBinding`, but nothing could reach it: the read-only
  `bind` implementations on `Derived`, `SelectorView`, `ReactiveSet` and
  `ReactiveMap` declared a single parameter, so `update` was discarded and the
  call returned a plain `Readable`.

  That is the exact call a mistake produces. A component prop typed `Signal<T>`
  is filled with a route's `data`, or something bound off it, which is read-only
  at runtime; the component then asks for a two-way view and gets a readable
  back. The failure surfaced much later and unrecognizably — a primitive doing
  `signal(props.value)` wrapped the readable itself, and a selector reading
  through it blew up on the readable object rather than the array it expected.
  The error now names the call that was wrong.

## 0.0.7

### Patch Changes

- [#65](https://github.com/ieedan/implement/pull/65) [`5077090`](https://github.com/ieedan/implement/commit/50770900102e0dafbccbf187054ed2cdfcdcefa5) Thanks [@ieedan](https://github.com/ieedan)! - Fix a path bind throwing when the value it reads through is missing. `getAtPath` treated a `null` or `undefined` along the path as an error, so `data.bind("issue").bind("title")` — or the equivalent `data.bind("issue.title")` — threw `Cannot read "title" from undefined` while the load was still in flight, taking the component down for a value that arrives a tick later. The same applied to `ref.bind("disabled")` before the node mounted. A path now reads through a missing value the way optional chaining does, reading `undefined` and updating when the value lands, which is also what the path types describe: `PathsOf` walks `NonNullable`, so binding through an optional field is the case they were written for. Writes still throw — a write has nowhere to land, rather than merely nothing to read — and now name the segment that was missing.

## 0.0.6

### Patch Changes

- [#53](https://github.com/ieedan/implement/pull/53) [`00239de`](https://github.com/ieedan/implement/commit/00239de0e84fe27b2f8737e977d973b4d24c454e) Thanks [@ieedan](https://github.com/ieedan)! - Add `mediaQuery(query, { fallback })`, a CSS media query as a `Readable<boolean>`.
  It listens only while something is listening to it, and reports the fallback on
  the server — and through hydration, so the pass matches the markup the server
  produced instead of throwing it out and re-rendering.

## 0.0.5

### Patch Changes

- [#54](https://github.com/ieedan/implement/pull/54) [`f60114f`](https://github.com/ieedan/implement/commit/f60114f329cd73c5922a60c8337566afa97d3f21) Thanks [@ieedan](https://github.com/ieedan)! - Mount a branch's children inside the region its end marker bounds, so a child
  that owns more than one node is torn down with the branch.

  `If` appended its branch children to the parent and then moved each child's
  first DOM node back in front of its end marker. A child standing on a single
  node came out right; a `ForEach` did not. Its rows went in as siblings of
  whatever else the parent held, and only the first of them was pulled inside the
  branch — the rest stayed past the marker, where the next swap neither moved nor
  removed them. Toggling a menu left its dots sitting beside the other branch's
  content, looking like both branches were mounted at once. Worse, the marker now
  stood between the `ForEach`'s first row and its own marker, so clearing the list
  took the branch's marker with it in the range deletion and the next swap threw.

  Branch children are now mounted against the end marker, the way `ForEach`
  already mounts its rows, so every node they own lands inside the region and
  leaves with it. The same fix applies to `Switch`, `Key`, `Dynamic`, `Await`,
  `ImplementBoundary`, `Portal` and `Outlet`, which all swap children the same
  way, and `Html` now attaches its delimiters through the same path so a block
  inside one of them is not split from its markup.

## 0.0.4

### Patch Changes

- [`14ce276`](https://github.com/ieedan/implement/commit/14ce276cf1a03340930ae030410551d23efa724e) Thanks [@ieedan](https://github.com/ieedan)! - Add `Dynamic`, a control-flow node that mounts whatever child a readable holds
  and swaps it when the value changes.

  `If` tests conditions and `Switch` matches values against branches written out
  ahead of time, so a node that comes _out_ of a signal had nowhere to go: a
  readable child is the text-node shape, and passing one where a node was meant
  rendered the function's source. Swapping what renders meant an `Outlet` driven
  from a subscription, or a `Key` around a thunk that re-read the signal itself.

  ```ts
  const icon = derived([priority], (p) => PRIORITIES[p].icon());
  SelectTrigger(Dynamic(icon));

  // or without the intermediate readable
  SelectTrigger(Dynamic([priority], (p) => PRIORITIES[p].icon()));
  ```

  The value is compared by identity, so a getter that builds a fresh node per
  call swaps on every change of its sources and one that returns a node it
  already holds leaves what is mounted alone; remounting the same value is still
  `Key`'s job. `null` and `undefined` render nothing, so a
  `Readable<Mountable | null>` needs no `If` around its empty case. Children
  mount at the node's position in the tree, so context resolves through it,
  errors reach the nearest boundary, and server rendering and hydration go
  through the same path as any other child.

  `Child` is unchanged: a bare `Div(currentView)` is still text, and `Dynamic` is
  how you say you meant the node.

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
