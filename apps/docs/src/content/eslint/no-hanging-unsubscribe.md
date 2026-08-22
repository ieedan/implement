---
title: no-hanging-unsubscribe
description: A subscription to a signal that outlives the function watching it, with its unsubscribe discarded.
section: Rules
order: 10
---

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

## Options

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

Nothing in the syntax separates those. Turn `checkParameters` on if your components are mostly the second kind — routed pages and context consumers — and expect to add a few [disable comments](/eslint/setup#turning-a-rule-off) for the first kind.
