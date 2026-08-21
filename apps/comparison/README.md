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
