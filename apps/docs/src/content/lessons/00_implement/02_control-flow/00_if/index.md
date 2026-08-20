---
title: If
description: Mount and unmount a branch when a condition changes.
section: Control flow
---

Often you will want to render components conditionally, for this you can use the `If` component.

The `If` component accepts a readable signal which it checks subscribes to and checks for truthiness. This means you can add a signal that is a plain `boolean` or a more complex signal like `User | null`.

You render components inside of it conditionally by using the chained `.Then()`, `.Else()`, and `.ElseIf()` methods.

```ts
If(open).Then(P("I'm open"));
```
