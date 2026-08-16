# Exploration: a function-based, lazily-constructed core

What it would look like to (1) transform the framework's classes into
functions and (2) make components thunks so everything is constructed
lazily. The two ideas are explored together because the second is what makes
the first pay off: closures give components private state, and thunks give
that state a lifecycle.

A working prototype lives in `packages/ui/src/fn/` (~700 lines, type-checked,
not exported from the package entry so the public API is untouched). Every
behavior claimed below was verified against it with a jsdom smoke test.

## TL;DR

- Classes → closures is mostly a mechanical win: the per-tag class zoo
  collapses to one-liners, the prop "overload zoo" (PAPERCUTS #11) collapses
  to a single `PropInput<V>` type any wrapper can forward, and the
  `Component<T>` invariance papercut (#5) disappears because interfaces with
  method syntax are bivariant.
- Thunks are the deeper change. Invoking component functions at **mount time**
  instead of tree-build time means construction happens at a known _when_ and
  _where_ — so the framework can finally own disposal (`computed`/`effect`
  auto-dispose with their subtree, fixing the `Derived` leak, MISSING #10),
  `If` branches build on first activation and rebuild fresh on reopen
  (PAPERCUTS #6), context re-reads on re-realization (PAPERCUTS #7), and
  code-splitting (`lazy(() => import(...))`) falls out for free.
- Rendering simplifies: comment-marker anchoring replaces the
  `getFirstDomNode`/`getInsertBeforeNode` sibling walk and the whole
  `parentNode`/`adopt` logical tree in `mountable.ts`.
- The honest costs: toggled-away state is _gone_ by design (you need an
  explicit keep-alive escape hatch), `context.use()` is only valid during
  realization (a hooks-like rule), and `ForEach` wants an explicit key
  function because realizing a row just to learn its key is exactly what a
  lazy model refuses to do.

## Where the class model creaks today

An inventory of what is currently a class, and the friction each carries:

| Class                                                     | Friction                                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Component<T>`                                            | invariant (`Component<"button">` ≄ `Component<HTMLTag>`, PAPERCUTS #5); `bindProperty` is `protected`, so userland wrappers re-implement the triple overload (PAPERCUTS #11) |
| `_a` … `_wbr` (~90 generated classes)                     | ~1100 lines of boilerplate whose only content is a tag name                                                                                                                  |
| `_input`, `_select`, `_textarea`                          | subclassing is the only extension mechanism; each prop repeats the overload pattern                                                                                          |
| `Signal`, `Derived`, `Ref`                                | `Derived` subscribes forever — created per-row/per-view it leaks (MISSING #10); no auto-tracked form                                                                         |
| `_if`, `_switch`, `_forEach`, `_key`, `_await`, `_portal` | children built eagerly and kept alive (PAPERCUTS #6); anchoring needs the fragile logical-tree walk                                                                          |
| `Context` + `MountNode` walking                           | `Use` reads once and never updates (PAPERCUTS #7); every `MountNode` carries `parentNode`/`adopt` bookkeeping just for this lookup and insertion anchors                     |

None of these are _caused_ by the `class` keyword per se — but the class
idiom (protected helpers, subclass extension, eager construction in
constructors, invariant generics) is what shaped them.

## Part 1 — classes become functions

### The component builder

`Component<T>` becomes a factory whose state lives in the closure. The object
it returns is the API surface and nothing else — there is no `protected`,
because helpers are either module-private (truly hidden) or exported (truly
reusable):

```ts
export function el<T extends HTMLTag>(tag: T, ...children: Child[]): ElementBuilder<T> {
	let element: ElementOf<T> | null = null; // private by construction
	const mountOps: Array<(el: ElementOf<T>) => void> = [];

	const self: ElementBuilder<T> = {
		bind(input, apply) {
			/* the one binding primitive */
		},
		className(value) {
			return this.bind(value, (el, v) => {
				el.className = v;
			});
		},
		on(event, handler) {
			/* … */
		},
		mount(parent, before) {
			/* … */
		},
		unmount() {
			/* … */
		},
	};
	return self;
}
```

Three structural consequences:

**The overload zoo dies.** Every prop today accepts
`value | Readable<V> | [signals, getter]` via three overloads, and wrappers
can't forward that without copying it (PAPERCUTS #11). In the function world a
prop is one union type — with the tuple form replaced by an auto-tracked
getter, since `subscribeTracked` already exists:

```ts
type PropInput<V> = V | Readable<V> | (() => V);

// binding a prop:
Span().className(() => (open.get() ? "menu open" : "menu"));

// forwarding a prop in a userland wrapper — no overloads, just pass it through:
function LabeledInput(label: PropInput<string>) {
	return Div(Span().content(label), Input().placeholder(label));
}
```

`watchProp(input, apply)` — the normalizer — is exported, and
`ElementBuilder.bind(input, apply)` exposes the same primitive built-ins use,
so wrapper components are first-class. The prototype's `Input` is built by
_wrapping_ `el("input")` with `Object.assign` instead of subclassing, and its
two-way `value()` is four lines.

**Invariance disappears.** `ElementBuilder` is an interface using method
syntax, and TS treats method parameters bivariantly — so
`ElementBuilder<"button">` is assignable to `ElementBuilder<HTMLTag>`.
Tracker's `Menu` no longer needs `Component<any>` for its trigger.

**The generated file collapses.** `_div extends Component<"div">` plus its
factory (12 lines × ~90 tags) becomes:

```ts
export const Div = tagFactory("div");
```

### Signals

`new Signal(0)` → `signal(0)`, `new Derived([a, b], (a, b) => …)` →
`computed(() => a.get() + b.get())` (auto-tracked, no dependency list to keep
in sync), `watch` → `effect`. Same `Readable`/`Writable` interfaces, so both
worlds interoperate — the prototype's closures call the same `noteRead` /
`subscribeTracked` machinery (`noteRead` needed a one-line export from
`signal.ts`; that is the only change to existing code in this branch).

One thing classes genuinely did better: `this`-typed helpers.
`toggle(this: Signal<boolean>)` lets `Signal<boolean>` offer `.toggle()` and
`Signal<string>` not. Object literals can't express per-method `this`
constraints, so those helpers become standalone functions (`toggle(sig)`,
`increment(sig)`) or stay off the core type. Minor loss, worth naming.

### Other trade-offs of dropping classes

- **Memory**: closures allocate the method record per instance; classes share
  a prototype. For a UI tree of hundreds-to-thousands of nodes this is real
  but small, and the lazy model offsets it — only _mounted_ UI exists at all.
  If it ever mattered, the factory can hang methods off a shared object
  internally without changing the API.
- **`instanceof` goes away.** `ForEach`'s `getKey` currently does
  `child instanceof Component`. Plain objects need a brand symbol — or, as the
  prototype chose, an API that never needs to sniff (explicit key function).
- **Truly private state.** Closure variables are unreachable from outside —
  stronger than `private`, which is a types-only fiction.

## Part 2 — components as thunks

### The semantic shift

Today a tree expression _is_ the construction:

```ts
// today: CreateIssueDialog() runs at App() time; the dialog and all its
// menus/signals exist before it's ever opened, and state persists across
// open/close (tracker needs openCreateDialog() to reset every form signal)
If(createDialogOpen).Then(CreateIssueDialog());
```

In the thunk model, children are `View | (() => View)` and control flow
invokes thunks on activation:

```ts
// prototype: pass the function itself — nothing is built until the dialog
// opens, and reopening builds a fresh one (no manual reset needed)
If(createDialogOpen).Then(CreateIssueDialog);
```

The call-site cost is nearly zero because user components are _already_
functions — you pass `CreateIssueDialog` instead of calling it. Inline
subtrees wrap in `() => Div(…)` only when they must be lazy; static children
can stay eager values.

Two phases emerge: **describe** (call `Div(...)`, cheap: closures + arrays,
no DOM, no subscriptions) and **realize** (mount: create the element, run the
recorded ops, subscribe, realize children). Unmount discards everything;
remount rebuilds from the description. Identity rules become simple to state:
static children keep identity for the parent's lifetime; dynamic regions
(`If` branches, `ForEach` rows, `Key` subtrees) get **fresh state per
activation**.

### Construction finally has a lifecycle

This is the load-bearing consequence. Because thunks run inside a known mount,
the framework wraps every realization in a scope; anything created during it
registers its disposer there, and deactivating the region runs the scope:

```ts
If(open).Then(() => {
	const filtered = computed(() => issues.get().filter(matches)); // auto-disposed
	effect(() => console.log(filtered.get().length));               // auto-disposed
	onCleanup(() => document.removeEventListener("keydown", esc));  // user hook
	return Div(…);
});
```

Today the equivalent `Derived` created inside a per-view component function
leaks on every rebuild (MISSING #10), and tracker's menu leaks `document`
listeners — there is nowhere to hang the cleanup. In the eager model this is
unfixable without asking users to thread disposal manually, because
construction happens "nowhere": at tree-build time, before any mount exists.

### Rendering mechanics: markers instead of a logical tree

Eager rendering needs `mountable.ts`'s parallel tree — `parentNode` links,
`adopt`, `getFirstDomNode`, `getInsertBeforeNode` — to answer "where do I
insert when a branch flips on between two siblings?" by walking constructed
siblings for their first DOM node. A lazy model _cannot_ answer that way: an
inactive branch has no constructed children to walk.

The fix is boring and standard: every dynamic region owns a comment node at
its slot and mounts content before it. `Div(A, If(c).Then(B), C)` renders
`<div>A <!--if--> C</div>`, and B mounts before the marker. `ForEach` rows own
a marker _pair_ and move as DOM ranges, so keyed reorder is
"move `[start…end]` before cursor" with no sibling walks at all. The entire
logical-tree layer — and `Portal`'s special-cased anchor overrides — goes
away; `Portal` becomes "mount region into another parent."

### Context becomes an environment — with one lesson learned

Since realization is synchronous inside mount, context wants to be a dynamic
scope rather than a tree walk: `Provide` extends an immutable env map around
its children's realization; `use()` reads it from any component function
underneath. Consumers stop being wrapper nodes:

```ts
const Theme = context<"light" | "dark">();

const Consumer = () => {
	const theme = Theme.use(); // read at realization, captured in closure
	return Span().content(theme);
};

Theme.Provide("dark", Div(If(open).Then(Consumer)));
```

The prototype's smoke test immediately caught the naive version's flaw: a
branch activated **later** (a signal flipping in an event handler) realizes
long after `Provide`'s mount returned, when the stack is empty. So dynamic
regions `captureEnv()` at mount and restore it around every later
realization — capture is O(1) because envs are immutable, copy-on-provide.
Nice side effect: re-realization re-reads current values, which is exactly
what PAPERCUTS #7 asks `Context.Use` to do.

The honest constraint: `use()` only works during realization (component body),
not later from an event handler — a hooks-like rule that needs documenting
and a clear error message (the prototype throws one).

### What else falls out

- **Code splitting**: `lazy(() => import("./heavy").then((m) => m.View()), Spinner())`
  is ~30 lines in the prototype — a thunk whose realization is async.
- **Error boundaries become possible** (MISSING #15): realization is a
  function call at a known place, so a `Boundary(child, fallback)` can
  try/catch it. Eager construction can't be caught anywhere useful.
- **Recursive components** (tree views rendering themselves) stop being
  infinite loops, since recursion only unrolls as deep as what's mounted.
- **`ForEach` stops discard-rendering.** Today every update re-invokes the
  render callback per item just to learn the child's key, then throws the
  fresh child away (MISSING #11's closing note). Lazy construction makes that
  cost intolerable — so the key becomes an explicit argument, which also fixes
  "keying is easy to get silently wrong" (PAPERCUTS #4):

  ```ts
  ForEach(
  	issues,
  	(issue) => issue.id,
  	(entry) => IssueRow(entry),
  ); // realized once per key, patched via entry signal
  ```

### The honest costs

- **Toggled-away state is gone by design.** Today `If` hides/shows live
  subtrees, so a collapsed panel keeps its scroll position and half-typed
  input. Fresh-per-activation is the better default (it's what the dialog
  wants) but the old behavior needs an opt-in — a `Keep(...)` wrapper that
  realizes once and re-mounts the same views on later activations. Sketched
  but not built in the prototype.
- **Realization-time rules.** `context.use()` and scope-bound `computed` /
  `effect` / `onCleanup` are only meaningful during realization. That's a new
  category of "you called this at the wrong time" error the eager model
  doesn't have.
- **Async boundaries need care.** Anything that realizes children after an
  `await` (`lazy`, an `Await` port) must capture and restore both scope and
  env; forgetting is a silent bug. The framework owns this, but every future
  flow primitive must remember it.
- **Migration is real work**: every `Component` subclass, flow class, and the
  `Await`/`Portal`/`Switch` helpers need porting, and call sites change shape
  (mostly deletions, but still churn).

## The prototype

```
packages/ui/src/fn/
├── scope.ts      realization scopes (onCleanup/runInScope) + context env capture
├── reactive.ts   signal() / computed() / effect(), closure-based, scope-aware
├── view.ts       View / Child / PropInput / watchProp / mountRegion
├── element.ts    el() builder, text() nodes, Input wrapper, tag one-liners, .attr()
├── flow.ts       lazy If / keyed ForEach (marker ranges) / Key / Fragment / lazy()
├── context.ts    context() with captured-env dynamic scoping
└── index.ts      exports (not re-exported from the package entry)
```

Since `.attr()` was a two-line method in this model, the prototype includes it
— incidentally the top item in MISSING.md (#1), and `text()` reactive text
nodes cover the "mixing text and elements" gap (#15).

Verified by smoke test (jsdom): reactive props via Readable and getter;
`If` laziness, else branches, fresh-state reactivation, and clean unmount;
`ForEach` single render per key, in-place patch, DOM-preserving reorder,
removal; marker anchoring order with mixed static/dynamic siblings; context
through late-activated branches; scope disposal of `computed` on branch
teardown; `Input` two-way binding; `Key` rebuilds; `lazy()` placeholder →
resolve; `attr()` including boolean attributes.

Not ported (nothing structural, just work): `Switch`, `Await`, `Portal`, the
full tag list, `Select`/`Textarea`, SVG (`el` could take a namespace — the fn
model makes MISSING #8 easier, not harder).

## Side-by-side

Kitchen-sink counter, current API:

```ts
const count = new Signal(0);
const level = new Derived([count], (c) => (c === 0 ? "idle" : c < 5 ? "warming" : "cooking"));

Div(
	Button()
		.content("Click me!")
		.on("click", () => count.increment()),
	P().content([count], (c) => `Clicked ${c} times!`),
).mount(root);
```

Function-based:

```ts
const count = signal(0);
const level = computed(() =>
	count.get() === 0 ? "idle" : count.get() < 5 ? "warming" : "cooking",
);

Div(
	Button()
		.content("Click me!")
		.on("click", () => count.update((c) => c + 1)),
	P().content(() => `Clicked ${count.get()} times!`),
).mount(root);
```

Same shape — the API style survives the transform. The differences are the
missing `[deps]` arrays and `new`, plus everything invisible here: the dialog
that doesn't exist until opened, the computed that dies with its branch, the
row that patches instead of rebuilding.

## Migration path, if this graduates

1. **Adopt the loose wins into the class core now** — no breakage:
   `watchProp`-style exported prop normalization (+ getter form of props),
   `.attr()`, a thunk-accepting `If.Then(() => …)` overload, an `AnyComponent`
   interface.
2. **Ship `fn/` as an experimental sibling** (this branch's shape). Both cores
   share `signal.ts` interfaces, so a demo can mix them; port one tracker view
   to feel the ergonomics.
3. **Decide**: if the lazy semantics hold up in a real view, port the
   remaining helpers, generate the full tag list, swap the package entry, and
   keep a thin compat layer (`new Signal` etc.) for a release.

Step 1 is worth doing regardless of the rest. The riskiest open design
question before step 3 is the `Keep`/keep-alive story, since it's the one
place the lazy default is a regression rather than a fix.
