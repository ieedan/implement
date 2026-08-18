---
title: Switch
description: Match a value against cases with deep equality, with an optional exhaustiveness check.
order: 8
---

`Switch` mounts the first `Case` whose value equals the subject, falling back to `Default`. Where [`If`](/docs/if) evaluates conditions, `Switch` matches values.

```ts
import { Switch } from "@implementjs/core";

type Status = "todo" | "in-progress" | "done";
const status = signal<Status>("todo");

Switch(status)
	.Case("todo", Icon("circle"))
	.Case("in-progress", Icon("half-circle"))
	.Case("done", Icon("check"))
	.Default(Icon("question"));
```

## Subjects

Pass a single readable, or several plus a getter that computes the subject from their values:

```ts
Switch([user, page], (u, p) => (u ? p : "login"))
	.Case("login", LoginForm())
	.Case("settings", Settings())
	.Default(Home());
```

## Matching

Cases compare with **deep equality**, so object values work:

```ts
Switch(position).Case({ x: 0, y: 0 }, P("At origin")).Default(P("Somewhere else"));
```

The first matching case wins. When nothing matches, the `Default` children mount (or nothing, if there is no `Default`).

## Exhaustiveness

The type of `Case` narrows as you chain: each case removes its value from the remaining union. `.Exhaustive()` only typechecks once **every** member has a case — a compile-time guarantee that adding a variant to the union breaks the build until it is handled:

```ts
Switch(status)
	.Case("todo", Todo())
	.Case("in-progress", InProgress())
	.Case("done", Done())
	.Exhaustive(); // ✅ compiles — all of Status is covered

Switch(status).Case("todo", Todo()).Exhaustive(); // ❌ type error — "in-progress" and "done" unhandled
```

The check is purely type-level; it changes nothing at runtime. Duplicate cases are also caught: a value already handled is no longer in the remaining union.

## Mounting semantics

Same as `If`: the children of the matched case are created when it shows and discarded when another case takes over. `Switch` only chooses which branch is mounted — children close over reactive values themselves for updates _within_ a branch.
