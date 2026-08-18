---
title: Switch
description: Render the branch that matches a value.
section: Control flow
---

`If` is great for conditions but sometimes you have a value with several possible states. Rather than chaining a bunch of `.ElseIf()` conditions you can use the `Switch` component to match against values directly.

`Switch` accepts a readable signal and mounts the first `.Case()` whose value matches it. If no case matches, the `.Default()` children are rendered instead.

```ts
Switch(status)
	.Case("loading", P("Loading…"))
	.Case("success", P("Done!"))
	.Default(P("Something went wrong."));
```

In the example on the right we have a `status` signal that cycles between `"loading"`, `"success"`, and `"error"` every time you click the button.

Try replacing the plain status text with a `Switch` that renders a `.Case()` for `"loading"` and `"success"`, and a `.Default()` for anything else.
