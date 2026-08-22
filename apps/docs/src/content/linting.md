---
title: Linting
description: Framework-aware lint rules for implement apps — leaked subscriptions, broken ARIA, and Lifecycle that could be Watch.
section: Building applications
order: 24
---

TypeScript catches a lot in an implement app, because there is no template language for it to lose sight of — a component is a function call and its props are an object literal. But some mistakes are the right shape and still wrong. `aria-lable` is a perfectly good key on a props object. A `subscribe` whose unsubscribe you drop on the floor type-checks exactly like one you keep.

[`@implementjs/eslint`](/packages) is a small set of rules for those. It is written against ESLint's plugin API, and it runs under **either** linter — ESLint, or [oxlint](https://oxc.rs) through oxlint's ESLint-compatible plugin support. One package, one set of rules, whichever linter you already have.

## Setup

### oxlint

Add the plugin to `jsPlugins` and turn the rules on. `jsPlugins` is where oxlint loads ESLint-format plugins from; everything else stays as it was.

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";

export default defineConfig({
	jsPlugins: ["@implementjs/eslint"],
	rules: {
		"implementjs/no-hanging-unsubscribe": "error",
		"implementjs/no-html": "error",
		"implementjs/no-redundant-roles": "warn",
		"implementjs/no-signal-collection": "warn",
		"implementjs/no-signal-condition": "error",
		"implementjs/prefer-effect": "warn",
		"implementjs/prefer-foreach": "error",
		"implementjs/role-has-required-aria-props": "error",
		"implementjs/role-supports-aria-props": "error",
		"implementjs/valid-aria": "error",
		"implementjs/valid-role": "error",
	},
});
```

> [!NOTE]
> oxlint's JS plugin support is in alpha and its docs say it is not covered by semver. Pin oxlint to an exact version if your CI depends on these rules, so a patch release cannot change the plugin API underneath you.

### ESLint

The same package is an ordinary flat-config plugin, and it ships a `recommended` config that turns on every rule at the severities above.

```ts
// eslint.config.ts
import implementjs from "@implementjs/eslint";

export default [implementjs.configs.recommended];
```

Or wire the rules up yourself, if you want different severities:

```ts
import implementjs from "@implementjs/eslint";

export default [
	{
		files: ["**/*.ts"],
		plugins: { implementjs },
		rules: { "implementjs/valid-aria": "error" },
	},
];
```

## What these rules can and cannot see

Every rule here works from syntax and scope alone. None of them ask TypeScript what a value is, and that is deliberate: oxlint does not give custom rules a type checker, so a rule that needed one would run under ESLint only.

They do read type **annotations**, which are just syntax: `id: Readable<string>` and `signal<Set<string>>()` say plainly what they are, and the rules below use that. What they cannot do is infer — a signal reached through a destructured prop or an import from another file is simply not recognised, and the rules stay quiet rather than guess.

That buys portability and costs precision, in one specific way. The rules cannot follow a value across a file boundary. `Div({ role: "buton" })` is caught because the typo is right there in the object literal. Whether your `DialogTrigger` eventually renders a `<button>` — that lives three files away behind `createComponent`, and no rule here can tell you.

One more consequence worth knowing: every rule recognises core's helpers by the import they came through, matched against `@implementjs/core` exactly. Re-export `signal` or `Html` from a barrel of your own and the rules stop seeing it.

So treat these as a spell-checker for the things you write down, not an audit of what your components resolve to. In practice that is where the mistakes are anyway.

---

## `no-hanging-unsubscribe`

Subscribing to a signal hands you back a function that stops it. Drop that function and the subscription outlives whatever made it — and so does everything its callback closed over.

The rule reports a `subscribe`, `onChange`, or [`watch`](/docs/derived) whose return value is discarded, when the signal being watched **outlives the function doing the watching**. That last clause is the whole rule, and it is what keeps it quiet on the common harmless case:

```ts
import { signal } from "@implementjs/core";
import { mode } from "@/lib/mode";

export function ModeToggle() {
	const preference = signal(mode.userPrefersMode.get());

	// fine — `preference` is created here, so it and the subscription
	// become garbage together when the component goes
	preference.onChange((value) => apply(value));

	// reported — `mode` is imported, so this subscription (and the closure
	// it drags along) lives for as long as the module does
	mode.userPrefersMode.subscribe((value) => preference.set(value));
}
```

The fix is to give the subscription an owner. [`ImplementLifecycle`](/docs/lifecycle) calls whatever `onMount` returns when it unmounts, so returning the unsubscribe is all it takes:

```ts
ImplementLifecycle({ onMount: () => mode.userPrefersMode.subscribe(apply) }, Content());
```

A subscription written at module scope is never reported — living as long as the app is usually the reason it is up there.

### Options

```ts
"implementjs/no-hanging-unsubscribe": ["error", { checkParameters: false }]
```

`checkParameters` (default `false`) decides whether a signal that arrived as a **parameter** counts as outliving the function. It is off by default because a parameter's lifetime belongs to the caller, and both answers are common:

```ts
// `state` was created by the caller one line before this call, and dies with it
export function MenuRoot(state: MenuState, ...children: Child[]) {
	state.open.subscribe(onOpenChange);
}

// `id` is a router param that outlives every page mounted against it,
// so this one really does leak
export function IssueView(id: Readable<string>) {
	id.onChange(refetch);
}
```

Nothing in the syntax separates those. Turn `checkParameters` on if your components are mostly the second kind — routed pages and context consumers — and expect to add a few `oxlint-disable-next-line` comments for the first kind.

## `prefer-effect`

[`ImplementEffect`](/docs/derived) subscribes when it mounts and unsubscribes when it unmounts. An `ImplementLifecycle` whose only job is to own a `watch` is doing that by hand:

```ts
// reported
ImplementLifecycle({ onMount: () => watch([theme], (t) => apply(t)) });

// what it means
ImplementEffect([theme], (t) => apply(t));
```

The rule only fires when the swap is a genuine simplification, so it stays quiet when the `ImplementLifecycle` has children, has an `onUnmount`, has any other prop, or uses the element `onMount` is handed.

It is also careful about _which_ subscription it matches. `watch` and the standalone `subscribe` run the effect immediately with the current values, which is what a plain `ImplementEffect` does. A readable's own `subscribe` and `onChange` methods deliberately **skip** that first run, so the rule leaves them alone rather than rewriting them into an effect that behaves differently:

```ts
// not reported — onChange skips the current value, a plain effect would not
ImplementLifecycle({ onMount: () => query.onChange(refetch) });
```

`ImplementEffect([query], refetch, { immediate: false })` is the equivalent of that last one, but the previous value `onChange` passes has no counterpart on an effect, so the rewrite is yours to make.

> [!WARNING]
> `ImplementLifecycle`'s `onMount` is deferred a microtask so the subtree is connected to the document; `ImplementEffect` subscribes during mount. The suggested rewrite is offered as an ESLint _suggestion_ rather than an autofix for that reason — if the effect measures or focuses DOM, check it before applying. `oxlint --fix` will not apply it; `oxlint --fix-suggestions` will.

## `no-html`

[`Html`](/docs/html) parses its string as-is and inserts the result as live nodes. There is no sanitization, so anything user-provided that reaches it is an XSS.

The rule reports **every** use of `Html` imported from `@implementjs/core`. That is the point: it is not trying to work out whether a particular string is safe — nothing here could — it is making each use a decision somebody wrote down.

```ts
import { Html } from "@implementjs/core";

// this repo's own markdown, compiled at build time; no visitor input reaches it
// oxlint-disable-next-line implementjs/no-html
Div({ class: "prose" }, Html(page.content));
```

Put the reason on the lines above and the directive immediately before the code — `oxlint-disable-next-line` applies to the line that follows the _comment_, so a reason wrapped onto a second line silently breaks it.

Aliasing on import does not get around the rule, and an `Html` of your own is not caught by it:

```ts
import { Html as Raw } from "@implementjs/core";
Div(Raw(markup)); // still reported

import { Html } from "./my-markdown"; // not core's, not reported
```

For SVG markup, [`Svg`](/docs/svg) is the better answer anyway — it caches parsed templates and gives the root typed, bindable props.

## `no-signal-condition`

A signal is an object, and every object is truthy. So a signal in a condition always takes the same branch — forever, silently, with no type error to warn you:

```ts
const open = signal(false);

// always "Close": `open` is an object, so the test is always true
const label = open ? "Close" : "Open";
```

The rule reports a signal tested for truth in any position where that goes wrong — a ternary, an `if`, a `while`, a `!`, and the left side of `&&` or `||`. The fix is to test the _value_, which is what [`bind`](/docs/bindings) is for:

```ts
const label = open.bind((o) => (o ? "Close" : "Open"));
```

Or, if you genuinely wanted a one-off non-reactive check, say so with `open.get()`.

It reports only when it can prove the value is a signal, from a factory call at the declaration (`signal`, `derived`, `ImplementSet`, `ImplementMap`, or a `.bind()` off another signal) or from a type annotation (`Signal`, `Readable`, `Writable`, `Derived`). A signal it cannot recognise is left alone.

> [!NOTE]
> `??` is not reported. A signal is never nullish, so `sig ?? fallback` is a different mistake — and one this rule does not claim to catch.

## `prefer-foreach`

`get()` reads a signal once. Map over that and you have rendered the list as it was at mount, with nothing left subscribed to change it:

```ts
// renders once and never updates
Ul(...rows.get().map((row) => Li(row)));

// re-renders as `rows` changes
Ul(
	ForEach(
		rows,
		(row) => row.id,
		(row) => Li(row),
	),
);
```

The rule reports `.get().map()` **only in a rendered position** — as an argument, or a spread argument, of a PascalCase callee. That is what separates a list being rendered from one being sent somewhere, and it keeps the rule quiet on the case where reading the current value is exactly right:

```ts
// fine — an event handler wants the value it has now
Button({ onClick: () => save(rows.get().map(toDto)) }, "Save");
```

`Map.prototype.get` takes a key, so `byId.get(id).map(...)` is never mistaken for the snapshot read.

## `no-signal-collection`

A signal notifies when you `set` it. Put a `Set` or a `Map` inside one and mutating it in place notifies nobody, so every change means copying the whole collection back through `set`:

```ts
const selected = signal(new Set<string>());

selected.update((s) => {
	const next = new Set(s);
	next.add(id);
	return next;
});
```

[`ImplementSet` and `ImplementMap`](/docs/reactive-collections) are real `Set`s and `Map`s that are also readables, so their own mutators notify:

```ts
const selected = ImplementSet<string>();
selected.add(id); // notifies
```

The rule reports a `signal()` holding a collection, whether that is visible from the value (`signal(new Set())`), the type argument (`signal<Map<string, number>>()`), or the annotation on the declaration (`const x: Signal<Set<string>> = …`). The suggestion rewrites the call and adds the import, but only when there is no annotation left describing the old shape.

### Opting out

Writing the **readonly** type is taken as a deliberate statement that the collection is replaced rather than mutated — which is a perfectly good reason to keep it in a signal — and opts out:

```ts
// not reported: replace-don't-mutate is the intent, and it is written down
const touched = signal<ReadonlySet<string>>(new Set());
```

## `role-has-required-aria-props`

Twelve ARIA roles are incomplete without a particular property. A `role="checkbox"` with no `aria-checked` announces itself as a checkbox and then cannot say whether it is ticked:

```ts
Div({ role: "checkbox" }); // reported: requires `aria-checked`
Div({ role: "checkbox", "aria-checked": checked }); // fine
```

The requirement lists come from [`aria-query`](https://www.npmjs.com/package/aria-query) — the same data `eslint-plugin-jsx-a11y` and Svelte's compiler warnings read — rather than being copied into this repo, because the spec's inheritance graph is not something worth hand-maintaining. Some of it is genuinely surprising: `slider` requires only `aria-valuenow`, not the whole min/max trio, and `separator` requires nothing at all.

A props object containing a spread is skipped, since the property this looks for might be arriving inside it.

## `role-supports-aria-props`

The other direction: an `aria-*` property the role does not take is simply ignored, which is worse than leaving it out because the code reads as though it works.

```ts
Div({ role: "button", "aria-checked": on }); // button has no checked state
Div({ role: "switch", "aria-checked": on }); // fine
```

Supported sets include everything a role inherits from its superclasses plus the global properties, so `aria-label` and `aria-hidden` are fine everywhere.

Two deliberate silences. An attribute `aria-query` has never heard of is left to [`valid-aria`](#valid-aria) rather than being called unsupported here — a gap in the table should read as no opinion, not as a mistake in your code. And a spread _after_ the `role` key could replace the role this was judged against, so those are skipped too; a spread before it cannot, so they are not.

## `no-redundant-roles`

Elements come with roles already. Writing one that matches changes nothing:

```ts
Button({ role: "button" }); // <button> is already a button
Nav({ role: "navigation" }); // <nav> is already navigation
Ul({ role: "list" }); // <ul> is already a list
```

This is the one ARIA rule here that needs to know which element it is looking at, so it only fires on core's element helpers — `Button`, `Nav`, `Ul` imported from `@implementjs/core`. A `DialogTrigger` that eventually renders a `<button>` is three files away, and no rule here can follow it. Aliasing on import is handled: the imported name decides the tag, not the local one.

Elements whose role depends on an attribute are resolved from the props beside them, so `Input({ type: "checkbox", role: "checkbox" })` is reported while `Input({ type: "text", role: "checkbox" })` is not.

## `valid-aria`

The `aria-*` props are typed as `` `aria-${string}` ``, which means the type system accepts any key that starts with `aria-` and any string, number, or boolean value. That is the right type — the alternative is a union that goes stale — but it means nothing checks your spelling.

This rule does. It reports an `aria-*` key that is not in [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/#state_prop_def), offering the nearest real attribute as a suggestion:

```ts
Div({ "aria-lable": "Close" });
//     ^ "aria-lable" is not an ARIA attribute. Did you mean "aria-label"?
```

It also checks values against what the attribute actually permits — booleans, tristates, enumerated tokens, integers, and numbers:

```ts
Div({ "aria-hidden": "yes" }); //     Expected true or false.
Div({ "aria-current": "pge" }); //    Expected page, step, location, date, time, true, false.
Div({ "aria-level": 1.5 }); //        Expected an integer.
```

Attributes whose value is an id, a list of ids, or free text are not checked — the ids they point at usually live in another file.

Only **literal** values are judged. A [readable](/docs/signals) is a legal prop value and what it will yield is a runtime question, so anything that is not a literal is skipped:

```ts
// not reported — nobody knows what this yields until it runs
Div({ "aria-current": derived([router.location], (l) => (l.path === href ? "page" : undefined)) });
```

Two more things it deliberately leaves alone: destructuring an `aria-*` prop reads one rather than sets one, and a Tailwind variant inside a `class` string is a value, not a key.

```ts
const { "aria-label": label } = props; // fine
Div({ class: "aria-invalid:border-destructive" }); // fine
```

Deprecated attributes get their own message rather than a spelling suggestion, since the fix is to delete them:

```ts
Div({ "aria-dropeffect": "copy" });
//     ^ deprecated in ARIA 1.1 and does nothing in any browser
```

### Options

```ts
"implementjs/valid-aria": ["error", { extraAttributes: ["aria-magic"] }]
```

`extraAttributes` adds names the rule should accept — for a draft ARIA attribute, or one your own code reads off the DOM.

## `valid-role`

The same idea for the `role` prop, checked against the concrete roles in [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/#role_definitions):

```ts
Div({ role: "buton" });
//          ^ not an ARIA role. Did you mean "button"?
```

ARIA lets `role` hold a space-separated fallback list and uses the first role the browser understands, so every token is checked and the suggestion rewrites only the one that was wrong.

Abstract roles get a message of their own. They exist to organise the ARIA taxonomy, authors are not allowed to use them, and browsers ignore them — but they read like plausible roles, which is exactly why they end up in code:

```ts
Div({ role: "widget" });
//          ^ abstract role; it does nothing on an element
```

As with `valid-aria`, only string literals are checked, and `role` bound to a signal is left alone.

### Options

```ts
"implementjs/valid-role": ["error", { extraRoles: ["doc-chapter"] }]
```

`extraRoles` adds roles from a vocabulary outside core ARIA — [DPUB-ARIA](https://www.w3.org/TR/dpub-aria-1.1/) and [graphics-aria](https://www.w3.org/TR/graphics-aria-1.0/) are the usual reasons.

## Turning a rule off

Both linters honour a disable comment on the line above, with the same syntax:

```ts
// oxlint-disable-next-line implementjs/no-hanging-unsubscribe -- the store outlives the app on purpose
telemetry.enabled.subscribe(flush);
```

Under ESLint the prefix is `eslint-disable-next-line` instead. For a whole directory — generated files, fixtures, a module full of ARIA tables — prefer an `overrides` entry in the config over a comment in every file.
