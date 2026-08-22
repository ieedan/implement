# implement vs. React vs. Svelte

The same application, written three times — once in [implement](../../packages/core),
once in React 19, once in Svelte 5 — plus a harness that measures what each one
ships to the browser and how fast it puts an update on screen.

Generated numbers live in [RESULTS.md](./RESULTS.md). This page is the method
and what the numbers mean.

```
apps/comparison
	implement/   @comparison/implement
	react/       @comparison/react
	svelte/      @comparison/svelte
	bench/       @comparison/bench — size, timing, and DOM-op measurement
	RESULTS.md   generated
```

## The app

An issue triage list. A toolbar with a text filter, a status segment control, a
sort selector, and an add form; a keyed list of rows; per-row checkbox, title,
priority badge, assignee, and delete; derived totals in the header. Plus a
benchmark panel that runs the operations below and reports the last timing, so
the app is drivable by hand as well as by the harness.

Run any of them:

```sh
pnpm --filter @comparison/implement dev   # :3010
pnpm --filter @comparison/react dev       # :3011
pnpm --filter @comparison/svelte dev      # :3012
```

The three render identical markup and identical CSS. Screenshots of the three
at the same state differ only in the word after "Issue triage".

## What is held constant

- **The stylesheet.** `src/app.css` is byte-for-byte identical in all three, so
  the size table is about JavaScript.
- **The data and the work per update.** `src/data.ts` is identical too: the same
  deterministic generator (mulberry32, fixed seed), and the same `visibleIssues`
  filter-and-sort. No app wins by doing less arithmetic per keystroke.
- **The markup.** Same elements, same class names, same nesting.
- **The build.** Vite 7, `target: es2022`, production mode, no manual chunking,
  no compression at the server. Sizes are measured off the emitted files.

## What is deliberately _not_ held constant

Each app is written the way its framework wants to be written, because that is
the thing worth comparing:

- **implement** — module-scope `signal`s, `derived` for the visible list and the
  totals, `ForEach` keyed by id, and per-row `bind` calls so a row's title, badge
  and class each update on their own.
- **React** — `useState`/`useMemo`/`useCallback`, rows wrapped in `memo` with
  stable callback identities so an unrelated update does not re-render 10,000
  rows.
- **Svelte** — runes. `$state.raw` for the list, because every update in this app
  replaces the whole array and a deep proxy would have nothing to observe;
  `$derived` for the visible list and totals; `{#each … (issue.id)}` keyed.

Two consequences worth stating out loud. React's row memoization is doing real
work here — without it every one of these numbers would be far worse, and it is
work the other two frameworks do not ask the author to do. And Svelte's
`$state.raw` is a deliberate choice: plain `$state` proxies every row object,
which is the idiomatic default but the wrong tool for a list this size.

## How the timings are taken

`window.__bench.run(name)` in each app applies one change and resolves once the
browser has painted the result. Getting that fair across three different
scheduling models is most of the harness:

1. Take a cheap fingerprint of the list (row count, the text of rows 0, 1, 998
   and last, and which row is selected).
2. Start the clock, apply the change.
3. Hop through the macrotask queue until the fingerprint stops moving. implement
   writes the DOM synchronously; Svelte flushes on a microtask; React commits
   from its own `MessageChannel` scheduler and will slice a large render across
   several tasks. Each hop yields a microtask first, so React's scheduler gets to
   post its message before the harness posts its own — otherwise the harness
   jumps the queue and the clock stops before React has rendered anything.
4. Wait out the frame that paints it (`requestAnimationFrame`, then a timeout
   inside it, which lands after paint).
5. Stop the clock and probe the DOM.

The driver asserts against that probe on every step: 1k rows means 1,000 `.row`
elements, "swap" means rows 1 and 998 actually traded places, "update every 10th"
means row 0's title actually gained its suffix. A framework that deferred work
past the point where the timer stopped fails the run instead of posting a fast
number — which is what the settling loop is there to prevent, and how it was
caught: without it, roughly one React sample in ten came back 3–5× too fast.

20 timed runs per app after 3 warmup runs, each in a fresh page, median reported.

## Results

Full tables in [RESULTS.md](./RESULTS.md). The short version:

### Size

|           | app JS (gzip) | hello world (gzip) |
| --------- | ------------: | -----------------: |
| implement |    **9.5 kB** |             5.5 kB |
| Svelte 5  |       16.9 kB |            10.4 kB |
| React 19  |       61.6 kB |            59.2 kB |

implement ships the smallest bundle of the three by a wide margin: 6.5× smaller
than React gzipped, 1.8× smaller than Svelte. Most of it is the runtime floor —
a hello-world page is 5.5 kB against Svelte's 10.4 kB and React's 59.2 kB.

The interesting column is what the app's _own_ code costs on top of that floor:
2.4 kB for React, 4.0 kB for implement, 6.4 kB for Svelte. Svelte's compiler
emits per-component template strings and effect wiring, so app code grows faster
there; React's app code is cheap because almost everything it needs is already in
the 59 kB runtime. At this app's size the floor dominates. A much larger app
narrows the gap to Svelte and never narrows the gap to React.

### Speed

implement is competitive on everything that touches a bounded number of rows,
and pays on everything that touches the whole list.

Where it is even or ahead:

- Fine-grained updates are its home turf. Selecting one row out of 10,000 is
  14 ms against React's 24 ms and Svelte's 23 ms — the click changes two rows'
  class attributes and nothing else in the tree is disturbed.
- Editing every 10th row, sorting, and re-sorting all land within a few percent
  of the other two.

Where it pays:

- **Creating rows** — 146 ms for 1k and 1221 ms for 10k, about 1.5× Svelte. The
  DOM-op tables say why: implement builds each row node by node and then inserts,
  11 insertions per row against Svelte's 2. Svelte clones a `<template>`, so its
  1,000 rows cost 2,000 insert calls no matter how many nodes are inside them.
- **Clearing rows** — 359 ms for 10k against ~105 ms for both others, the widest
  gap in the whole table. `unmount` walks the row and removes **every descendant
  individually**: 100,000 `removeChild` calls to delete 10,000 rows, where React
  and Svelte each make 10,000. Filtering shows the same thing at smaller scale
  (8,890 removals against 889). This looks like the single highest-value fix in
  the framework — dropping the row's own element once would take the whole column
  down to the other two.
- **Reordering** — swapping two rows of 1k costs 74 ms against Svelte's 18 ms,
  because `syncDomOrder` walks the list backwards and cascades: moving row 998 to
  position 1 shifts every node between them, 997 `insertBefore` calls for a
  two-element swap. Worth noting React does exactly the same thing (997 calls,
  72 ms) — Svelte is the outlier here, not implement the laggard.
- **Memory** — 89.5 MB with 10,000 rows on screen against 23 MB for both others,
  3.9×. Roughly 9 kB per row. Each row in the implement app holds a `ForEachItem`
  signal, an index signal, a `derived` for its class, and four `bind`s, each with
  its own subscriber map and closure. That is the standing cost of per-node
  reactivity without a compiler: the graph that makes "select one row of 10k"
  fast is the same graph that is sitting in memory.

Startup is a wash — 46 ms to mounted against 39 ms and 36 ms, on an app whose
initial list is 200 rows.

## What to fix in implement

Ranked by how implement compares to whichever of React and Svelte was faster on
each operation, the gaps clustered on three pieces of framework code rather than
spreading across the board: removing rows, reordering rows, and building rows.

Thirteen changes follow, made over five measure-fix-measure passes on the
`perf-prototype` branch. Where they got to:

| operation                | baseline |      now | Svelte | React | ratio |
| ------------------------ | -------: | -------: | -----: | ----: | ----: |
| swap two rows of 1k      |      108 |   **22** |     22 |   113 | 1.05× |
| swap two rows of 10k     |      206 |  **134** |    115 |   224 | 1.17× |
| clear 10k rows           |      382 |  **184** |    137 |   170 | 1.35× |
| clear 2k rows            |       74 |   **43** |     35 |    41 | 1.27× |
| filter 1k by text        |       46 |   **26** |     22 |    27 | 1.15× |
| clear the filter         |      159 |  **136** |    108 |   113 | 1.26× |
| create 1k rows           |      209 |  **167** |    140 |   150 | 1.19× |
| create 10k rows          |     1757 | **1466** |   1216 |  1520 | 1.20× |
| append 1k to 1k          |      207 |  **166** |    140 |   145 | 1.21× |
| sort 1k by title         |      124 |  **122** |    120 |   128 | 1.01× |
| sort 1k back by id       |      107 |  **113** |    108 |   112 | 1.05× |
| update every 10th of 1k  |       24 |   **22** |     22 |    24 | 1.11× |
| update every 10th of 10k |      147 |  **151** |    152 |   165 | 0.99× |
| select one row of 1k     |       15 |   **16** |     15 |    15 | 1.17× |
| select one row of 10k    |       24 |   **25** |     29 |    28 | 0.89× |
| JS heap at 10k rows (MB) |     89.5 | **48.0** |   23.6 |  23.0 | 2.09× |

Clearing 10,000 rows more than halved, a two-row swap went from 5× Svelte to
level with it, and the heap came down 46%. The bundle grew 1.1 kB gzipped over
the same span — 10.22 kB to 11.29 kB, against 16.9 kB for Svelte and 61.6 kB for
React.

### How these numbers are taken

Two things were wrong with the harness at the start and are worth stating,
because both produced results that read as regressions and then reversed:

- **The apps ran one at a time.** Every rep of implement, then every rep of
  React, then Svelte — so a machine that slowed down for half a minute landed
  entirely on whichever app was running. All three are now served for the whole
  run and take turns rep by rep.
- **Ratios came from comparing medians.** They now come from pairing each rep
  of implement with the reps of React and Svelte that ran beside it and taking
  the median of the per-rep ratios, which cancels the noise the two share.

Even so, the p10–p90 band on the smaller operations is wider than the 10% the
table is being judged against: `select one row of 1k` spans 0.67×–2.11×, and
`append 1k` spans 0.92×–1.57×. Those four or five rows cannot be resolved to
10% on this hardware, and the ones below can:

| resolved and over   | ratio | p10–p90   |
| ------------------- | ----: | --------- |
| JS heap at 10k rows | 2.09× | 2.09–2.09 |
| clear 10k rows      | 1.35× | 1.16–1.51 |
| clear 2k rows       | 1.27× | 1.13–1.46 |
| clear the filter    | 1.26× | 1.13–1.38 |
| create 10k rows     | 1.20× | 1.13–1.29 |
| create 1k rows      | 1.19× | 1.10–1.34 |

### The thirteen changes

**Teardown.** `Component.unmount` unmounted children first and each child
removed its own node, so discarding one row made ten `removeChild` calls where
one would do; a detach depth counter lets a node unmounting under an element
that is already removing itself skip its own removal. Listeners on a node being
discarded are no longer individually removed. The unsubscribe chain — four
closures to release one binding — lost a hop when `Notifier` started handing
back an id and exposing `removeSubscriber`.

**Reordering.** `syncDomOrder` walked the list backwards inserting any node
whose next sibling was wrong, so moving one row past 997 others shifted all 997.
It now keeps the longest already-ordered run in place and repositions only the
rest, and returns immediately when nothing moved. A fresh list is also mounted
against `ForEach`'s end marker rather than appended past it and moved back, which
removed 10,000 node moves the browser was doing and undoing.

**Allocation.** A literal `class` string sets the attribute and returns a shared
no-op instead of allocating a map, a set, an array and two closures. Static props
return that same no-op rather than a fresh `() => {}`. Text children became
classes, and an element whose whole content is one readable owns the text node
directly instead of mounting a child for it — three of the ten mountables in this
row. Selector binds stopped building a `Derived`: `SelectorView` reads through
its source the way path binds already did, and follows a nested readable only if
one appears. The tree parent link moved from a `WeakMap` to a symbol field
(measured 40× cheaper per write) and is only written while an error boundary is
live. `subscribe` grew a one-source path with no arrays. `createElement`,
`createTextNode` and `attach` skip their hydration checks when no hydration pass
is running.

### Where it stops, and why

The remaining six are all the same thing measured six ways. Building 10,000 rows,
in one page, through the same settle-and-paint wait:

|                                           | create 10k |
| ----------------------------------------- | ---------: |
| hand-written DOM, no framework            |     793 ms |
| implement with every binding stripped out |    1044 ms |
| implement as the app writes it            |    1106 ms |

The reactive graph is 62 ms of that. The other 250 ms is the machinery around
100,000 mountables — an object per element, its props walked, its children
mounted — about 2.5 µs each. Svelte lands near 1.10× of the same floor because
its compiler emits straight-line code that constructs no such object.

Memory says it more sharply. Weighing 20,000 copies of one thing on a fresh page
with a forced collection each time:

|                                                     | retained |
| --------------------------------------------------- | -------: |
| the row's data object                               |     38 B |
| a signal holding it                                 |     70 B |
| the same signal with one subscriber                 |    183 B |
| the row's six values wired by hand                  |    234 B |
| the row's reactive graph as the framework builds it |   2147 B |

A bare subscription is **113 B**, and it is two closures: the callback, and the
closure `subscribe` returns to cancel it. A row needs at least six. Reaching
Svelte's 23.6 MB means the whole graph fits in about 450 B per row — and six
subscriptions alone are 678 B, before a single binding object exists.

So the two remaining costs are the two things that define the framework:

- **An object per element and per binding, built at runtime.** Removing it means
  knowing a component's shape before it runs, which means a compiler. implement's
  own description is "a simple ergonomic ui framework without a compiler".
- **A subscription that is two closures.** Removing it means `subscribe` no
  longer returning an `Unsubscribe` function — a public API change, not an
  optimization.

Neither is impossible to build. Both are a different framework. Everything
reachable without changing them has been taken, and it moved the heap 46% and
the worst operation 52% without moving a single public API.

One thing worth noting for anyone continuing: template cloning is not the answer
here. Building 10,000 rows of this shape costs 724 ms node by node and 673 ms by
cloning a `<template>` and filling in three text positions — about 7%. The cost
is not how the nodes get built.

## Reading this fairly

- The sort steps are dominated by `localeCompare` on 1,000 strings, which is app
  code shared by all three. That all three land within 5% of each other there is
  a sanity check on the harness, not a finding about the frameworks.
- 10,000-row lists are a stress test, not a UI anyone should ship. The 200-row
  default state is closer to what these numbers mean for a real page, and at that
  size every difference above is below the threshold of perception.
- These ran in a cloud container, which is noisier than a workstation. Medians
  over 20 runs are stable to a few percent; treat sub-10% differences as ties.
- One browser (Chromium 141), one machine, no CPU throttling. A 4× throttle would
  widen the gaps roughly proportionally and would change which of them a user
  actually notices.
- Bundle size is measured off the built files. A real deployment adds a server,
  and React's 61 kB is a one-time cost that caches across the whole site.

## Running the measurements

```sh
pnpm --filter "@comparison/*" build          # both builds of each app
pnpm --filter @comparison/bench size         # bundle sizes → results/sizes.json
pnpm --filter @comparison/bench bench        # timings     → results/bench.json
pnpm --filter @comparison/bench dom-ops      # DOM counts  → results/dom-ops.json
pnpm --filter @comparison/bench report       # all three   → RESULTS.md
```

`BENCH_REPS` and `BENCH_WARMUP` override the run counts. The driver uses
Playwright's Chromium; set `CHROMIUM_PATH` to point it at a different binary, and
it will fall back to whatever is under `PLAYWRIGHT_BROWSERS_PATH` on its own.

The DOM-op pass patches the DOM mutation methods before the app boots, which
makes the page slower — it reports counts only, never timings.
