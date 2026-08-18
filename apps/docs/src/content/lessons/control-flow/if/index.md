---
title: If
description: Mount and unmount a branch when a condition changes.
section: Control flow
order: 6
---

`cond && Badge()` is evaluated once when the component runs. For a condition that changes later, use `If`. It mounts children while the condition holds and unmounts them when it stops.

```ts
If(open, Panel()).Else(P("Closed"));
```

A lone signal is tested for truthiness. Boolean signals work with `toggle()`.

Show the panel only while `open` is true, and flip that signal from the button.
