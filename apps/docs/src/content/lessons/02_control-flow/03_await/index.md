---
title: Await
description: Render from a promise's state.
section: Control flow
---

Not all of your data is available synchronously. When your UI depends on a promise you can use the `Await` component to render each of its states.

`Await` accepts a promise (or a readable signal of a promise) and lets you chain what to render for each state:

- `.WhileLoading()` renders while the promise is pending
- `.Then()` renders once it resolves, receiving the resolved value
- `.Catch()` renders if it rejects, receiving the error

```ts
Await(promise)
	.WhileLoading(P("Loading…"))
	.Then((value) => P(value))
	.Catch((error) => P("Something went wrong: ", error.message));
```

In the example on the right `fetchGreeting()` returns a promise that resolves after a short delay, but right now the greeting never makes it to the screen.

Use `Await` to show a loading message with `.WhileLoading()` while the greeting loads, and render it with `.Then()` once it resolves.
