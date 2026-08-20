# Motion in implement

An investigation into [Motion](https://motion.dev) (`motion@13`) and what it
would take to give implement users the whole library in a way that feels
native — plus a spec for `@implementjs/motion`, the package that would do it.

Everything below marked **(verified)** was run against a real build: a Vite
app with `@implementjs/core` from this workspace plus `motion@13.1.1`, driven
in Chromium.

## The short version

Half of Motion already works in implement, and works _better_ here than it
does in React. The imperative API (`animate`, `hover`, `press`, `inView`,
`scroll`, `stagger`, `springValue`, `animateView`) needs an element and a
lifetime; implement has `ref()` and `Implement.Lifecycle`, so wiring it up is
five lines and no framework support at all. Synchronous rendering means
`animateView` — Motion's View Transitions wrapper, and the vanilla answer to
layout animations — works with no `flushSync` equivalent, which React cannot
say.

The other half does not exist for vanilla Motion at all. `whileHover`,
`variants`, `layout`, `drag` and `AnimatePresence` are not part of the
`motion` package: they live in the React and Vue bindings, built on top of
`motion-dom`'s `VisualElement` / feature / projection system. There is no
"use the JS API harder" path to them.

And one thing is a hard wall today: **exit animations are impossible in
implement**, at any level of effort, from userland. `unmount()` is
synchronous everywhere (`If`, `ForEach`, `Key`, `Switch`, `Await`, `Portal`,
the router), so an element is out of the DOM before the next microtask
(verified). A package cannot work around it either, because the tree API a
control-flow helper needs (`mountChild`, `asParent`, `guarded`) is not
exported, and hand-rolling it breaks `context` and error boundaries
(verified — the hand-rolled version throws `context.Use() was called without
a matching context.Provide()` the second time it mounts).

So: **yes, build a package** — but the presence protocol belongs in
`@implementjs/core`, not in it. The package's job is lifetime, reactivity and
declarative props; core's job is "this subtree is leaving, hold the DOM
still until it says it's done". Getting that split wrong means the motion
package ships its own `If`/`ForEach`, and the framework forks in half.

## 1. What Motion actually is

Three layers, and knowing which is which decides the whole design:

| Layer       | Package                                   | What it holds                                                                                                                     |
| ----------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Primitives  | `motion-dom`, `motion-utils`              | `MotionValue`, the frame loop, WAAPI/JS animation drivers, `hover`/`press`/`resize`, projection nodes, `VisualElement`, `Feature` |
| Vanilla API | `motion` (re-exports `framer-motion/dom`) | `animate`, `scroll`, `inView`, `stagger`, `spring`, `transform`, `mix`, `animateView`, `frame`, `delay`                           |
| Bindings    | `motion/react`, `motion-v` (Vue)          | `motion.div`, `variants`, `while*`, `layout`, `drag`, `AnimatePresence`, `Reorder`, `LayoutGroup`, `MotionConfig`                 |

The vanilla API is _imperative and element-shaped_: you hand it an element (or
a selector, or a `MotionValue`) and it mutates it. It has no idea a component
tree exists. The bindings are where the declarative model lives, and each one
is a real port — `motion-v` is ~3,600 lines of shipped JS and re-implements
the gesture, animation-state and layout features on top of `motion-dom`
primitives, including a note that its `createAnimationState` is "ported from
motion-dom … execution is Vue-specific".

That is the size of the "full parity" job, and it is worth knowing up front
that no framework gets `motion.div` for free.

## 2. What already works (verified)

All of this ran unmodified against today's `@implementjs/core`.

### Enter animations, gestures, scroll, in-view

`ref()` + `Implement.Lifecycle` is exactly the shape Motion's imperative
functions want: an element, and a cleanup.

```ts
function EnterBox() {
	const el = ref<HTMLDivElement>();
	return Div(
		{ this: el, class: "box", style: { opacity: "0" } },
		Implement.Lifecycle({
			onMount: () => {
				const controls = animate(
					el.get()!,
					{ opacity: 1, y: [40, 0] },
					{ duration: 0.6, ease: "easeOut" },
				);
				return () => controls.stop();
			},
		}),
	);
}
```

`hover`, `press`, `inView`, `scroll` and `resize` all return an unsubscribe,
which is precisely what `onMount` wants returned — the cleanup and the
subscription lifetime line up with no adapter:

```ts
Implement.Lifecycle({
	onMount: () => {
		const stop = hover(el.get()!, (element) => {
			animate(element, { scale: 1.2 }, { type: "spring", stiffness: 400 });
			return () => animate(element, { scale: 1 }, { type: "spring" });
		});
		return stop;
	},
});
```

Verified: hover mid-spring reads `matrix(1.19674, …)`, `press` interrupts it,
both tear down on unmount.

### MotionValues bind into props with a six-line adapter

`MotionValue` is `{ get(), set(), on("change", cb) }` — one method name away
from implement's `ReadableSource<T>` (`{ get(), subscribe(cb) }`). Core's
`subscribe()` seeds from `.get()` and only wants change notifications after
that, so the adapter is trivial and complete:

```ts
const fromMotionValue = <T>(mv: MotionValue<T>) => ({
	get: () => mv.get(),
	subscribe: (cb: (v: T) => void) => mv.on("change", cb),
});
```

Verified: a `springValue()` driven by `x.set(200)` smoothly drives a
`translate` style binding to `199.671px`. Every element prop in implement is
`Bindable`, so a MotionValue can drive _anything_ — `class`, `href`,
`aria-*` — not just transforms. That is a nicer story than `motion.div`'s
style-only MotionValues, and it costs six lines.

### Layout animations, via View Transitions

`animateView()` wraps `document.startViewTransition` and lets Motion's easing
and spring options drive the pseudo-element animations. In React you must
`flushSync` inside the callback or the DOM will not have changed yet.
implement renders synchronously on `signal.set`, so this just works:

```ts
Button({
	onClick: () => {
		animateView(() => items.set([...items.get()].reverse()), {
			default: { duration: 0.6, type: "spring", bounce: 0.2 },
		});
	},
});
```

Verified: with `viewTransitionName` on each row, reversing a `ForEach` list
ran 20 concurrent pseudo-element animations and settled in the new order.
Shared-element transitions across route changes are the same call around
`navigateTo`.

This matters for scoping: the single most-wanted feature of `motion.div`
(`layout`) has a working vanilla answer here _today_, without projection.

### Bundle cost

Measured with esbuild, minified + gzipped:

| Entry                                              | gzip    |
| -------------------------------------------------- | ------- |
| `@implementjs/core` (App + If + ForEach + signals) | 7.5 kB  |
| `motion/mini` `animate` (WAAPI only)               | 3.1 kB  |
| `motion` `animate`                                 | 22.7 kB |
| `+ hover + press + inView`                         | 23.8 kB |
| `+ scroll + springValue + stagger + animateView`   | 29.2 kB |

Full Motion is roughly four times the framework. That is an argument for the
wrapper package being a thin, tree-shakable layer with `motion` as a **peer
dependency** — never a hard one — so an app that only needs
`motion/mini` never pays for the JS animation engine, and so users pick their
own Motion version (and their own Motion+ license).

### SSR is safe by construction

`import "motion"` under Node succeeds — nothing touches `document` at module
scope (verified). Calling into it does: `animate("#a", …)` throws `document
is not defined`, and animating a MotionValue crashes asynchronously on
`HTMLElement is not defined` (core's hand-rolled server DOM does not install
globals either). Since `Lifecycle.onMount` is already a documented no-op
during `renderToString`, the natural rule — _Motion calls live in onMount_ —
is also the SSR-safe rule. The wrapper should make that structural rather
than a documentation note.

## 3. What hurts today (verified papercuts)

These are in the spirit of [PAPERCUTS.md](PAPERCUTS.md) — things that exist
but cut.

**1. Every animated element costs a `ref` and a `Lifecycle`.** Five to eight
lines of ceremony per element, repeated. It is not hard, it is just loud, and
it puts the animation three levels away from the props it animates:

```ts
Div({ this: el, class: "card" }, Implement.Lifecycle({ onMount: () => { … } }));
```

**2. `this` is nulled before children unmount.** `Component.unmount()` runs
`this.#props.this?.set(null)` _before_ unmounting its children, so a
`Lifecycle` child's `onUnmount` reads `el.get() === null` (verified). Any
teardown that needs the element — measuring, an exit animation, a manual
`.stop()` on a node — has to capture it in `onMount` into a closure. Two
plausible fixes: null the ref after children unmount, or pass the element to
`onUnmount` the way `onMount` receives the parent.

**3. Motion and `style` bindings both write inline styles.** A reactive
`style: { opacity: … }` binding and a running `animate(el, { opacity })`
fight, last write wins. `motion.div` solves this by making MotionValues the
single owner of a property. The wrapper needs the same rule — a property is
owned by the animation _or_ by a binding, and it should be a type error, or
at least a dev warning, to do both.

**4. Exit animations are impossible.** The wall. `If`'s `clear()`, `ForEach`'s
removal pass, `Key.remount`, `Switch`, `Await`, `Portal` and the router all
call `child.unmount()` synchronously, and `Component.unmount()` calls
`element.remove()` in the same tick. Verified: with the node captured in a
closure, `onUnmount` fires, and by the very next microtask
`node.isConnected === false`. The exit animation runs — invisibly, on a
detached node.

There is no CSS escape either. The reason `apps/docs` animates dialogs and
menus with `transition-discrete` + `@starting-style` + `hidden` is that the
primitives keep content mounted and toggle `data-state`. That works, and it
is the right call today, but it means every animatable thing must be
permanently mounted, and it rules out list transitions entirely.

**5. A userland package cannot fix #4.** A control-flow helper that defers
`unmount()` is easy to write — the deferred version animated out correctly on
the first try. But mounting children _correctly_ needs `mountChild`,
`asParent` and `guarded` from `src/tree.ts`, none of which are exported (nor
reachable: `package.json` exposes only `.`, `./elements`, `./router`,
`./server`). Calling `instance.mount(parent)` directly skips
`parents.set(instance, current)`, so the subtree is orphaned: `context`
lookups walk to nothing and error boundaries never see its throws. Verified —
the hand-rolled presence helper renders fine on first mount (it inherits the
ambient parent by accident) and throws `context.Use() was called without a
matching context.Provide()` when it re-mounts from a subscription callback.

**6. No declarative model, and no path to one from the vanilla API.**
`whileHover`, `variants`, `whileInView`, `layout`, `drag`, `AnimatePresence`,
`Reorder`, `LayoutGroup`, `MotionConfig` are binding-level features. Reaching
them means building a binding on `motion-dom` the way `motion-v` did.

## 4. So: a package?

Yes — `@implementjs/motion`, with `motion` as a peer dependency. But the split
matters more than the answer:

- **Core owns presence.** "This subtree is leaving; hold it until it says
  it's done" is a property of the tree, not of an animation library. If the
  motion package owns it, it must ship `Motion.If`, `Motion.ForEach`,
  `Motion.Key` and a `Motion.Router`, and users pick a side per call site.
  That is the failure mode to design against.
- **Core exports the tree API.** `mountChild`, `asParent`, `guarded`,
  `parentOf` under a `@implementjs/core/tree` entry, documented as the
  contract for third-party helpers. Right now implement has no story for
  anyone writing a control-flow helper outside core — the motion package is
  just the first to need it.
- **The package owns lifetime, reactivity and props.** Everything else:
  `Motion.Div(...)`, variants, gestures, MotionValue bridging, config
  context.
- **The package re-exports vanilla Motion untouched.** `animate`, `scroll`,
  `stagger`, `springValue`, `animateView` already work. Wrapping them would
  add surface, lock users to our version of Motion's docs, and buy nothing.
  The rule: _wrap only what touches the tree_.

## 5. Proposed API

### 5.1 Element factories

`Motion.Div`, `Motion.Span`, `Motion.Button`, … one per tag, generated the
same way `packages/core/scripts/seed-components.ts` seeds `elements.ts`.
Props are core's `ElementProps` plus Motion's, so `class`, `onClick`, `this`
and `data-*` keep working:

```ts
Motion.Div(
	{
		class: "card",
		initial: { opacity: 0, y: 20 },
		animate: { opacity: 1, y: 0 },
		exit: { opacity: 0, y: -20 },
		whileHover: { scale: 1.03 },
		whilePress: { scale: 0.97 },
		transition: { type: "spring", bounce: 0.2 },
	},
	"Hello",
);
```

The native-feeling part, and the thing React cannot do: **every Motion prop is
`Bindable`.** React changes `animate` by re-rendering; implement subscribes.

```ts
Motion.Div({
	animate: open.bind((o) => (o ? "open" : "closed")),
	variants: {
		open: { height: "auto", opacity: 1 },
		closed: { height: 0, opacity: 0 },
	},
});

// or a target object straight from a signal
Motion.Div({ animate: derived([x, y], (x, y) => ({ x, y })) });
```

A `MotionValue` should be accepted anywhere a `Bindable` is — the adapter
from §2 applied at the prop layer, so `style: { x }` works with a raw
MotionValue and so does `class`.

### 5.2 Presence

Reads as core control flow, because it _is_ core control flow:

```ts
Motion.Presence(
	If(open).Then(
		Motion.Div({
			initial: { opacity: 0 },
			animate: { opacity: 1 },
			exit: { opacity: 0, scale: 0.95 },
		}),
	),
);

Motion.Presence({ mode: "wait" }, Key(route, PageFor(route)));

Motion.Presence(
	ForEach(
		items,
		(i) => i.id,
		(item) =>
			Motion.Li(
				{ exit: { opacity: 0, x: -20 }, layout: true },
				item.bind((i) => i.label),
			),
	),
);
```

`mode` mirrors Motion: `"sync"` (default), `"wait"` (old subtree finishes
before the new one mounts), `"popLayout"` (exiting nodes go `position:
absolute` so siblings can close the gap immediately).

### 5.3 Gestures, viewport, scroll, drag

Props, matching Motion for React so the docs transfer:
`whileHover` / `whilePress` / `whileFocus` / `whileInView` + `viewport`,
`onHoverStart` / `onHoverEnd` / `onPressStart` / `onTap`, `drag` /
`dragConstraints` / `dragSnapToOrigin` / `whileDrag`.

Scroll-linked work stays imperative and re-exported — `scroll()` already
composes with `springValue()` and prop bindings with nothing in between.

### 5.4 Config

```ts
Motion.Config.Provide({ reducedMotion: "user", transition: { duration: 0.3 } }).To(App());
```

Built on core's `context()`. `reducedMotion: "user"` is the one that matters:
today `apps/docs` reaches for `motion-reduce:` Tailwind variants per
component, and it belongs at the root instead.

### 5.5 Values

```ts
import { fromMotionValue, toMotionValue } from "@implementjs/motion";

const progress = motionValue(0);
Div({ style: { width: fromMotionValue(mapValue(progress, [0, 1], ["0%", "100%"])) } });

const smooth = springValue(toMotionValue(scrollY)); // implement signal -> MotionValue
```

## 6. What core has to grow

Three changes; only the third is real work.

**A. Export the tree API** (`@implementjs/core/tree`: `mountChild`,
`asParent`, `guarded`, `parentOf`). Unblocks any third-party helper, not just
this one.

**B. Fix the `this`-before-children ordering** (papercut #2), and pass the
element to `Lifecycle.onUnmount`.

**C. A presence protocol in the removal path.** Today every helper calls
`child.unmount()`. Route them all through one `removeChild(child)` in
`tree.ts`:

- A node may register an exit hook (`registerExit(node, () => Promise<void>)`)
  — `Motion.Div` does this on mount when it has an `exit` prop.
- `removeChild` collects hooks in the subtree. **None → unmount synchronously,
  exactly as today.** No async, no cost, no behavior change for every app
  that does not animate.
- Some → mark the subtree exiting, run the hooks, unmount when they all
  settle. An exiting subtree stays in the DOM but out of the logical tree.
- `syncDomOrder` learns about exiting nodes so `If`/`ForEach`/`Key` can place
  incoming siblings around one that is still leaving.
- Re-adding the same `ForEach` key while it is exiting must interrupt the exit
  and re-adopt the node — the case that makes hand-rolled presence wrong.

The payoff is bigger than Motion: once removal has one path, `Portal`, the
router, `Await` and `Switch` all get exit transitions, and any future
animation approach (CSS, Web Animations, GSAP) can use the same hook. It is
also the piece with the most design risk, which is why §7 puts a prototype
in front of the package.

## 7. Plan

**Phase 0 — core hooks.** A and B above, plus `removeChild` as a pure
refactor (no behavior change) so every removal already goes through one
place. Small, independently useful, no new dependency.

**Phase 1 — `@implementjs/motion`, thin.** Peer-dep `motion`, re-export the
vanilla API, ship `fromMotionValue` / `toMotionValue` and a `Motion.Animate`
helper that is `ref` + `Lifecycle` with the ceremony removed. Deletes the
boilerplate from §3.1 without committing to a declarative model. This alone
covers most of what `demos/tracker` and `apps/docs` would ask for.

**Phase 2 — presence.** Core change C, then `Motion.Presence` on top. This is
the phase that unblocks the primitives: dialogs, menus, popovers and toasts
stop needing permanently-mounted content and `transition-discrete` tricks.
Prototype the exiting-node bookkeeping in `packages/core/tests/` before the
package depends on it.

**Phase 3 — declarative props.** `Motion.Div` and friends: `initial`,
`animate`, `exit`, `variants`, `transition`, `while*`, `viewport`, config
context, all `Bindable`. Ported from `motion-v`'s `MotionState` + feature
classes, which are ~80% framework-agnostic — the Vue-specific parts are
reactivity glue and SFCs, and implement's signals replace them one-to-one.
Variant propagation to children (a parent's `animate: "open"` driving
children's variants) needs the same parent/child registry `MotionState` keeps,
which core's `context()` already models.

**Phase 4 — layout and drag, if wanted.** `layout` via projection
(`HTMLProjectionNode`, scale correctors, `LayoutGroup`) and `drag` via a
port of `VisualElementDragControls` + `PanSession`. This is the expensive
half of a binding, and it is genuinely optional here: `animateView` covers
most layout cases already (§2), and projection needs a "measure before this
mutation" moment that implement — with no render pass, only fine-grained
signal writes — does not naturally have. Worth deferring until there is a
demo that `animateView` cannot serve.

## 8. Open questions

- **`Motion.Div` vs. props on core elements.** Motion props could live on
  `Div` itself, gated by an optional core integration, instead of a parallel
  factory set. Fewer imports and no "which Div?" question, at the cost of
  putting Motion's types in core's prop surface and duplicating the tag list.
- **Do gestures belong on props at all,** given `hover()`/`press()` compose
  fine imperatively? `whileHover` earns its place mainly when it interacts
  with variants and the animation-state priority order.
- **Style ownership** (papercut #3): warn, type-error, or let last write win?
- **Motion+** ships separately (`motion-plus`, with a `motion-plus-dom` half
  alongside `motion-plus-react`). Its DOM half looks like the same imperative,
  element-shaped API, so it should slot in the same way — but it is paid, so
  nobody here has run it, and we should not claim support until someone with
  a license does.
- **`packages/kit`**: route transitions want `animateView` around
  `navigateTo` plus presence on the router outlet — worth designing together
  with Phase 2 rather than after it.
