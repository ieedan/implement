---
title: Context
description: Pass a value down the tree without threading it through every component's props.
section: Composition
order: 12
---

Context carries a value from a provider to any descendant, however deep, without prop drilling. You create one with the `Context()` function:

```ts
import { Context } from "@implementjs/core";

type Session = { user: Readable<User>; logout: () => void };

export const SessionContext = Context<Session>();
```

Context is then used in two stages.

### 1. Providing the context

`Provide(value).To(...children)` makes the value available to everything in the wrapped subtree:

```ts
app.render(SessionContext.Provide({ user, logout }).To(Shell(router)));
```

Providers nest, and the **nearest** provider above the consumer wins, so a subtree can locally override a value.

### 2. Using the context

`Use(render)` looks up the nearest provided value and renders with it:

```ts
function UserBadge() {
	return SessionContext.Use(({ user }) => Div({ class: "badge" }, user.bind("name")));
}
```

`Use` throws if no provider is above it. When a default makes sense, `UseOr` supplies one instead of throwing:

```ts
const ThemeContext = Context<"light" | "dark">();

ThemeContext.UseOr((theme) => Icon(theme), "dark");
```

## Reactivity

The provided value itself is fixed at mount. For values that change over time, provide a signal (or an object containing signals) and let consumers bind to it:

```ts
const theme = signal<"light" | "dark">("dark");
const ThemeContext = Context<Signal<"light" | "dark">>();

ThemeContext.Provide(theme).To(App());

// consumer: reads and writes
ThemeContext.Use((theme) =>
	Button({ onClick: () => theme.update((t) => (t === "dark" ? "light" : "dark")) }, "Toggle theme"),
);
```

## Scope

Lookup follows the **component tree**, not the DOM tree. Children rendered elsewhere via [`Portal`](/docs/portal) still see the contexts from where they were declared, because the portal keeps them in the logical tree.

Shared state is one part of structuring an app. The next is running setup and teardown at the right moments, which is the job of [Lifecycle](/docs/lifecycle).
