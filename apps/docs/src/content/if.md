---
title: If
description: Conditional rendering with If, ElseIf, and Else branches driven by signals.
order: 7
---

`If` mounts children while a condition holds and unmounts them when it stops. Branches chain with `ElseIf` and `Else`; the first branch whose condition holds is mounted.

```ts
import { If } from "@implementjs/core";

If(loggedIn, Profile()).Else(LoginForm());

If(isLoading, Spinner()).ElseIf(error, ErrorMessage(error)).Else(Content());
```

## Conditions

Three forms are accepted, for `If` and `ElseIf` alike:

```ts
// 1. a signal, checked for truthiness
If(user, ProfileCard());

// 2. a plain boolean (fixed forever — useful for feature flags)
If(DEBUG, DebugPanel());

// 3. several signals + a getter over their values
If([query, items], (q, list) => q !== "" && list.length === 0, P("No results"));
```

A lone signal is tested for truthiness, so `If(user, ...)` covers the common "not null" case without a getter.

## Then

Children can be passed directly after the condition or through `.Then(...)` — the two are equivalent; `Then` just reads better in longer chains:

```ts
If(open).Then(DropdownMenu()).Else(CollapsedLabel());
```

## Mounting semantics

- Children are **created when their branch shows and discarded when it hides**. Local state inside a branch (signals created in a component in that branch) resets every time the branch remounts.
- Switching branches unmounts the old branch's subtree completely — subscriptions, listeners, and [lifecycle hooks](/docs/lifecycle) all run their teardown.
- The children you pass close over signals as usual; `If` decides _whether_ they are mounted, signals decide what they show while mounted.

```ts
If(open).Then(
	Panel(),
	// listeners scoped to the open state — detached when the branch hides
	Implement.Document({ onKeydown: closeOnEscape }),
);
```

For matching one value against many cases, reach for [Switch](/docs/switch); for remounting on every change of a value, see [Key](/docs/key).
