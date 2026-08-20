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

One thing _was_ a hard wall: exit animations. `unmount()` was synchronous
everywhere (`If`, `ForEach`, `Key`, `Switch`, `Await`, `Portal`, the router),
so an element left the DOM before the next microtask, and userland could not
work around it — the tree API a control-flow helper needs (`mountChild`,
`asParent`, `guarded`) is unexported, and hand-rolling it breaks `context`
and error boundaries. **That is fixed** (§4): removal now runs through one
path in `src/exit.ts`, and `Implement.Lifecycle({ onExit })` holds a leaving
subtree on screen until its promise settles.

So: **yes, build a package** — but presence stayed in `@implementjs/core`
rather than going in it. The package's job is lifetime, reactivity and
declarative props; core's job is "this subtree is leaving, hold the DOM still
until it says it's done". Getting that split wrong would have meant the motion
package shipping its own `If`/`ForEach`, and the framework forking in half.

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

### Enter and exit, end to end

With `onExit` in core (§6), the whole loop works without the package. This is
a real file, running in Chromium against `motion@13`:

```ts
Button({ onClick: () => open.toggle() }, "toggle");

If(open).Then(
	Div(
		{ class: "dialog" },
		Animate({
			initial: { opacity: 0, scale: 0.9, y: 8 },
			animate: { opacity: 1, scale: 1, y: 0 },
			exit: { opacity: 0, scale: 0.95, y: 4 },
			transition: { type: "spring", bounce: 0.25, duration: 0.4 },
		}),
		"dialog",
	),
);

ForEach(
	items,
	(item) => item.id,
	(item) =>
		Div(
			{ class: "row" },
			Animate({
				initial: { opacity: 0, y: 20 },
				animate: { opacity: 1, y: 0 },
				exit: { opacity: 0, scale: 0.6 },
				whileHover: { scale: 1.1 },
				whilePress: { scale: 0.95 },
				transition: { duration: 0.35 },
			}),
			item.bind((i) => i.label),
		),
);
```

`Animate` is a co-mounted child rather than a wrapper element, which is the
shape core already suggests: `Lifecycle.onMount` hands over the element it
mounted into, so there is no `ref` at the call site and no extra DOM node. The
whole thing is about forty lines:

```ts
export function Animate(props: MotionProps = {}): Mountable {
	let el: HTMLElement | null = null;
	const to = (keyframes: DOMKeyframesDefinition, options?: AnimationOptions) =>
		el ? animate(el, keyframes, options ?? props.transition) : undefined;

	return Implement.Lifecycle({
		onMount: (parent) => {
			el = parent;
			// written as styles, not animated: an animation would resolve on the
			// next frame and the enter animation would read the wrong start value
			for (const [key, value] of Object.entries(props.initial ?? {})) {
				setStyle(parent, key, value as string | number);
			}
			if (props.animate) to(props.animate);

			const gesture = (active: DOMKeyframesDefinition | undefined, bind: typeof hover) => {
				if (!active) return null;
				const rest = baseValues(parent, props, Object.keys(active));
				return bind(parent, () => {
					to(active);
					return () => to(rest);
				});
			};

			const stops = [gesture(props.whileHover, hover), gesture(props.whilePress, press)];
			return () => stops.forEach((stop) => stop?.());
		},
		onExit: (signal) => {
			if (!props.exit) return;
			const animation = to(props.exit);
			signal.addEventListener("abort", () => {
				animation?.stop();
				if (props.animate) to(props.animate);
			});
			return animation;
		},
	});
}
```

Two details in there are the ones a sketch gets wrong, and both showed up as
bugs the first time. `initial` has to be written as a style rather than a
zero-duration animation, or Motion resolves it on the next frame and the enter
animation starts from the wrong value — the element simply appears. And a
gesture needs somewhere to animate _back_ to: `whileHover: { scale: 1.1 }`
with an `animate` that never mentions `scale` leaves the element stuck at
`1.1` unless the base value is resolved up front (`readTransformValue` for
transforms, computed style otherwise). Motion for React solves the same
problem with variant priority and `prevResolvedValues`; this is the
two-property version of it, and the fact that it is subtle at forty lines is
most of the argument for §5.

Verified: the dialog reads `0.81` opacity 60ms after opening and `0.08`
mid-exit; a new row fades in at `0.33`; a dropped row holds its slot
(`[a, b, c, x3]` stays put at `0.43`) and settles to `[a, c, x3]`; hover
scales to `1.1` and releases back to `none`; and `mapValue(springValue(...))`
drives a `width` prop from `733px` mid-spring to its settled `1215px`.

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

**4. Exit animations were impossible — now fixed (§4).** `If`'s `clear()`,
`ForEach`'s removal pass, `Key.remount`, `Switch`, `Await`, `Portal` and the
router all called `child.unmount()` synchronously, and `Component.unmount()`
called `element.remove()` in the same tick. Verified at the time: with the
node captured in a closure, `onUnmount` fired, and by the very next microtask
`node.isConnected === false` — the exit animation ran invisibly, on a
detached node.

There is no CSS escape either. The reason `apps/docs` animates dialogs and
menus with `transition-discrete` + `@starting-style` + `hidden` is that the
primitives keep content mounted and toggle `data-state`. That works, and it
is the right call today, but it means every animatable thing must be
permanently mounted, and it rules out list transitions entirely.

**5. A userland package could not have fixed #4** — which is why it landed in
core. A control-flow helper that defers
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

- **Core owns presence — done, see §6.** "This subtree is leaving; hold it
  until it says it's done" is a property of the tree, not of an animation
  library. Had the motion package owned it, it would have had to ship
  `Motion.If`, `Motion.ForEach`, `Motion.Key` and a `Motion.Router`, with
  users picking a side per call site. It lives in `src/exit.ts` instead, and
  `Implement.Lifecycle({ onExit })` is the whole user-facing surface.
- **Core still owes the tree API.** `mountChild`, `asParent`, `guarded`,
  `parentOf` under a `@implementjs/core/tree` entry, documented as the
  contract for third-party helpers. Presence no longer needs it, but implement
  still has no story for anyone writing a control-flow helper outside core.
- **The package owns lifetime, reactivity and props.** Everything else:
  `Motion.Div(...)`, variants, gestures, MotionValue bridging, config
  context.
- **The package re-exports vanilla Motion untouched.** `animate`, `scroll`,
  `stagger`, `springValue`, `animateView` already work. Wrapping them would
  add surface, lock users to our version of Motion's docs, and buy nothing.
  The rule: _wrap only what touches the tree_.

## 5. Proposed API

`Animate` (§2) already covers a lot at forty lines. What the package adds is
the part that does not stay small: variants and their priority order, base
values resolved properly rather than per-gesture, MotionValues accepted
directly as props, reduced-motion config, and the element factories that make
it read as one thing instead of a child hanging off every animated element.

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

## 6. What core grew (implemented)

The presence protocol landed, along with the ordering fix behind papercut #2.
What is left for later is exporting the tree API (`@implementjs/core/tree`:
`mountChild`, `asParent`, `guarded`, `parentOf`) for third-party helpers.

**One removal path.** Every helper used to call `child.unmount()` directly.
They all go through `removeChild(child)` in `src/exit.ts` now, which splits
removal from teardown:

- `removeChild` — the swap paths (`If` changing branch, `ForEach` dropping a
  row, `Key` remounting, `Switch`, `Await`, the router's outlet). May defer.
- `forceUnmount` / `teardownChildren` — the teardown paths (a helper's own
  `unmount`, `App.unmount` on HMR dispose, a hydration mismatch discard, a
  `Boundary` swapping in `Catch`, a `Portal` re-teleporting). Never defers,
  and aborts any exit already in flight so nothing animates over a tree that
  is going away.

**Registration walks up, not down.** `registerExit(hook)` reads the node
being mounted and adds the hook to every ancestor's set, so a removal at any
depth answers "does this subtree animate out?" with one `WeakMap` lookup. An
app that never registers a hook pays nothing and removes exactly as
synchronously as before — that is the invariant the first test pins down.

**Deferral keeps the subtree whole.** Nothing is unmounted while it leaves:
the nodes stay on screen, subscriptions stay attached, and `unmount()` runs
only once the hooks settle. That makes cancellation free — a `ForEach` key
re-added mid-exit aborts the hook and puts the same live instance back, no
remount and no lost state — and it is why the leaving subtree keeps updating
from outer signals, which is the one behavior worth knowing about. Aborting a
hook does not oblige it to settle, so each run carries a generation and a
cancelled run that resolves late is ignored rather than cutting short the exit
that replaced it.

**Ordering follows the previous DOM order, not indices.** A live row's index
is in the new list's coordinate space and a leaving row's in the old one, so
mixing them mis-sorts (the first cut did: dropping two of three rows ordered
them `a c b`). `ForEach` keeps the last key order and splices each leaving
row back behind the neighbour it followed, so it holds its slot and the rows
around it close the gap only once it is gone. `If`/`Switch`/`Key`/`Await` and
the router keep leaving children ahead of incoming ones — Motion's `sync`
mode. `mode: "wait"` (hold the new content until the old one finishes) is a
later addition, not a redesign.

Verified in Chromium with real Motion: an `If` branch fades out (opacity
`0.30` mid-exit) and then leaves; a dropped `ForEach` row holds its slot at
`0.43` while `[a, b, c]` stays put, settling to `[a, c]`; re-adding the key
mid-exit revives the same node at full opacity with no duplicate. Nine tests
in `packages/core/tests/exit.test.ts` cover the same ground headless, and the
existing 65 still pass unchanged.

The payoff is bigger than Motion: `Portal`, the router, `Await` and `Switch`
all got exit transitions from the same change, and any other animation
approach — CSS, Web Animations, GSAP — uses the same hook.

## 7. Plan

**Phase 0 — core hooks. Done.** The presence protocol, the single removal
path, and the `this`-before-children ordering fix, all in core with no
dependency on Motion (§6). What is still open from this phase is exporting
the tree API for third-party helpers.

**Phase 1 — `@implementjs/motion`, thin.** Peer-dep `motion`, re-export the
vanilla API, ship `fromMotionValue` / `toMotionValue` and a `Motion.Animate`
helper that is `ref` + `Lifecycle` with the ceremony removed. Deletes the
boilerplate from §3.1 without committing to a declarative model. This alone
covers most of what `demos/tracker` and `apps/docs` would ask for.

**Phase 2 — presence ergonomics.** The protocol is in; what is left is the
sugar. `Motion.Presence` as a wrapper reads better than an `onExit` hook at
every call site, and `mode: "wait"` / `"popLayout"` are still to come. This is
also the phase that unblocks the primitives: dialogs, menus, popovers and
toasts can stop keeping content permanently mounted with
`transition-discrete` tricks and mount conditionally like anything else.

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
  `navigateTo`; the router outlet already defers on exit hooks, so what is
  left is deciding the API for it.
- **Should an exiting subtree freeze?** It stays subscribed today, so
  bindings reading outer signals keep updating while it animates out. Freezing
  would need a way to suspend a subtree's subscriptions, which core does not
  have and which would cost more than it buys until something demands it.
