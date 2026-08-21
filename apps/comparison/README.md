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
| implement |   **10.0 kB** |             6.4 kB |
| Svelte 5  |       16.9 kB |            10.4 kB |
| React 19  |       61.6 kB |            59.2 kB |

implement ships the smallest bundle of the three, and it is not close on the
React side: 6.2× smaller gzipped, 5.9× smaller brotli. Against Svelte the margin
is 1.7×, and it comes almost entirely from the runtime floor — a hello-world page
is 6.4 kB in implement against 10.4 kB in Svelte.

The interesting column is what the app's _own_ code costs on top of its floor:
2.4 kB for React, 3.6 kB for implement, 6.4 kB for Svelte. Svelte's compiler
emits per-component template strings and effect wiring, so app code grows faster
there; React's app code is cheap because almost everything it needs is already in
the 59 kB runtime. At this app's size the floor dominates and implement wins
comfortably. A much larger app narrows the gap to Svelte and never narrows the
gap to React.

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
each operation, the gaps cluster on three pieces of framework code rather than
spreading across the board: removing rows, reordering rows, and building rows.
Splitting each operation into framework JavaScript and browser work says where
optimizing pays — clearing 10k rows is almost entirely JavaScript, while creating
10k rows is roughly half layout and paint that every framework pays alike.

Nine changes follow. All nine are implemented and measured on the
`perf-prototype` branch, in back-to-back runs of the baseline and the optimized
builds on the same machine. (The tables above are a separate, earlier
run on a different host and the two are not directly comparable — the container
was replaced mid-session, and the untouched React and Svelte apps measured 1.48×
slower afterwards, which is what caught it.)

| operation                | baseline | + 1–6 |    + 7–9 | change | Svelte | React |
| ------------------------ | -------: | ----: | -------: | -----: | -----: | ----: |
| swap two rows of 1k      |      108 |    22 |   **21** |   −80% |     21 |   108 |
| clear 10k rows           |      382 |   223 |  **187** |   −51% |    142 |   166 |
| swap two rows of 10k     |      206 |   138 |  **124** |   −40% |    122 |   229 |
| clear 2k rows            |       74 |    53 |   **46** |   −38% |     34 |    43 |
| filter 1k by text        |       46 |    32 |   **31** |   −32% |     23 |    28 |
| append 1k to 1k          |      207 |   166 |  **146** |   −29% |    152 |   141 |
| create 1k rows           |      209 |   186 |  **168** |   −20% |    147 |   150 |
| create 10k rows          |     1757 |  1600 | **1511** |   −14% |   1260 |  1532 |
| update every 10th of 1k  |       24 |    23 |   **21** |   −11% |     23 |    24 |
| clear the filter         |      159 |   139 |  **146** |    −8% |    116 |   115 |
| sort 1k by title         |      124 |   122 |  **115** |    −7% |    130 |   125 |
| JS heap at 10k rows (MB) |     89.5 |  71.1 | **63.7** |   −29% |   23.6 |  23.1 |

implement now matches Svelte on a two-row swap, beats it on appending 1k rows,
sorting by title, editing every tenth of 10k and selecting one row of 10k, and
trails it on everything that creates or destroys rows in bulk.

The one result that had been going the wrong way — sorting 1k rows back by id,
107 ms at baseline against 140 ms after fixes 1–4 — has come back to 105 ms and
now looks like it was run-to-run noise rather than the reordering pass.

### 1. Take a subtree out in one call

`Component.unmount` unmounted children first and each child removed its own node,
so discarding one row made ten `removeChild` calls where one would do. A detach
depth counter in `tree.ts` lets a node unmounting under an element that is
already removing itself skip its own removal and only release its subscriptions.
`Portal` resets the counter, because its children hang off a parent of its own.

Removals to clear 10,000 rows go from 100,000 to 10,000 — exactly what React and
Svelte make. **Going further, to a single bulk removal, buys nothing**: removing
10,000 rows one at a time measured 41.7 ms against 41.4 ms for one
`Range.deleteContents()` spanning all of them and 38.7 ms for `replaceChildren`.
Chromium charges per detached node, not per call. And the JavaScript walk cannot
be skipped whatever the DOM does, because a row's bindings subscribe to signals
that outlive it — the row watching whether it is selected is subscribed to a
module-level signal, and leaving that subscription in place is a leak.

### 2. Move only the rows that actually moved

`syncDomOrder` walked the list backwards inserting any node whose next sibling
was not where it should be, so moving one row past 997 others shifted all 997.
Keeping the longest already-ordered run of nodes in place and repositioning only
the rest — a longest-increasing-subsequence pass, as Vue and Svelte do — makes a
two-row swap two moves. A guard in front returns immediately when nothing moved,
which is what most updates do. 997 moves become 2.

### 3. Stop paying for props that never change

A literal `class` string now sets the attribute and returns a shared no-op
instead of allocating a `Map`, a `Set`, an array and two closures; a static prop
returns that same no-op rather than a fresh `() => {}`; an element whose props
are all static leaves with no unsubscriber array to walk; and a listener on a
node being discarded is no longer individually removed.

### 4. Allocate less per node

`mountChild` stopped allocating two callbacks per node — a hundred thousand of
them to build ten thousand rows — and `reconcileChildren` maps its arguments
directly in the shape almost every call has.

**This is where an earlier version of this document was wrong.** It claimed
cloning a `<template>` per row, as Svelte does, was the largest remaining win.
Measured against a hand-written baseline it is worth about 7%: building 10,000
rows of this exact shape costs 724 ms node by node and 673 ms by cloning a
template and filling in three text positions. Against implement's 1,813 ms that
recovers roughly 50 ms. The cost of creating a row is not how its nodes get
built — it is the reactive graph built alongside them, about eight readables and
ten mountable objects per row, each with its own closure and subscription.

### Where creating a row actually goes

Building the same 10,000 rows three ways, on the same page, splits the cost into
parts that want different fixes. Measured before fixes 5–9, and again after:

|                                              |  create 10k |     JS heap |
| -------------------------------------------- | ----------: | ----------: |
| the app's row, before                        |     1388 ms |     77.3 MB |
| the app's row, after                         | **1217 ms** | **63.8 MB** |
| the same row with no bindings at all, before |     1074 ms |     29.8 MB |
| the same row with no bindings at all, after  |     1134 ms | **21.5 MB** |
| hand-written DOM, no framework               |      724 ms |           — |

Reading the first pair against the third: the reactive graph cost 314 ms and
47.5 MB before, and 83 ms and 42.3 MB after. Reading the second pair on its own:
the fixed cost of a mounted element dropped from 29.8 MB to 21.5 MB, which is
below React's 23.1 MB for its _reactive_ row. The create times of the static row
differ by less than this measurement's run-to-run spread.

### 5. A cheaper parent link

Every mounted node recorded its tree parent in a `WeakMap`, purely so a thrown
error can walk up to the nearest boundary. A weak-map write measures about 40×
the cost of a symbol-keyed field (24.2 ms against 0.58 ms per 100,000), and it
runs once per node — a hundred thousand times to build ten thousand rows. It now
writes a symbol field, and only while an error boundary is live, since nothing
else reads the link.

### 6. One-source subscriptions

`subscribe()` kept a values array, an unsubscribers array and a closure to
unsubscribe through, whatever the number of sources. Every binding and most
deriveds have exactly one source, and a row carries about eight of them. The
one-source path keeps none of the three.

Together, fixes 5 and 6 took the same page from 1,388 ms to 1,296 ms and 77.3 MB
to 71.1 MB.

### 7. One object per selector bind

`bind(selector)` built `new Flattened(new Derived(...))`, where the wrapper
exists only to unwrap a selector that returns a readable — which most never do.
`FlatDerived` is the `Derived` itself with the unwrap overridden onto `read` and
`watch`, so a bind allocates one object instead of two. The gate the inner
`Derived` used to provide moves into `watch`, so an unchanged getter result still
does not tear down and rebuild the nested chain; there is a test for that,
because it is the part the merge could plausibly have broken.

### 8. Text nodes as classes

Static and reactive text children were object literals holding three closures
each. Four text children a row and ten thousand rows is forty thousand of them,
and an instance of a class costs one allocation where the literal cost four.

### 9. No children array for childless elements

`Component` allocated its mounted-children array up front. It is now allocated
on the first child, so a void element like `Input` never carries one.

Fixes 7–9 together took the heap from 71.1 MB to 63.8 MB.

### The element machinery, decomposed

The fourth item on the earlier list was the ~350 ms of element machinery above
the DOM floor, which had no named owner. Profiling it after these fixes says it
no longer has one to find: `mountChild` fell from 6.0% of creation to 0.5%,
garbage collection from 14% to 8.8%, and what remains is the browser
(`(program)`, 64.7%) plus the native DOM calls themselves —
`appendChild`, `createElement`, `addEventListener`, `setAttribute`,
`insertBefore` and `createTextNode` together about 11%. No framework function is
above 1.2%.

The one structural option left there is event delegation: 4 listeners a row is
40,000 `addEventListener` calls, 2.5% of creation. Every one of them is a real
listener because that is what the element API promises, so replacing them with a
delegated root handler is an API change, not an optimization.

### What no amount of work removes

Two floors, measured on the same page with no framework involved — plain
`createElement` and `remove` calls against the same row shape:

|                    | implement | browser's own share |  Svelte |
| ------------------ | --------: | ------------------: | ------: |
| build 10,000 rows  |   1813 ms |              724 ms | 1208 ms |
| remove 10,000 rows |    270 ms |              118 ms |  141 ms |

Roughly 40% of creating 10,000 rows and 44% of clearing them is browser work
every framework pays alike. Svelte sits about 480 ms above the build floor and
23 ms above the removal floor; implement sits 1,090 ms and 152 ms above them.
That headroom is work available, not a wall.

The one genuine limit is the design itself. Fine-grained reactivity without a
compiler means an object per reactive position, created at runtime, where a
compiler can emit code that closes over a shared template and allocates nothing
per row. implement can make each object smaller and rarer; it cannot make the
count zero. That sets a floor on memory and creation somewhere above Svelte —
though at 3.2× the heap today, it is nowhere near that floor yet.

All nine fixes are about 330 lines across seventeen files, keep the core tests
green (73 now — the merge in fix 7 brought one with it), and add roughly 700
bytes gzipped, still the smallest bundle of the three by a wide margin.

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
