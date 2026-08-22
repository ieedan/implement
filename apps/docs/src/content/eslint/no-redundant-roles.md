---
title: no-redundant-roles
description: A role an element already has, written out again on core's element helpers.
section: Rules
order: 20
---

Elements come with roles already. Writing one that matches changes nothing:

```ts
Button({ role: "button" }); // <button> is already a button
Nav({ role: "navigation" }); // <nav> is already navigation
Ul({ role: "list" }); // <ul> is already a list
```

This is the one ARIA rule here that needs to know which element it is looking at, so it only fires on core's element helpers — `Button`, `Nav`, `Ul` imported from `@implementjs/core`. A `DialogTrigger` that eventually renders a `<button>` is three files away, and [no rule here can follow it](/eslint/how-rules-work). Aliasing on import is handled: the imported name decides the tag, not the local one.

Elements whose role depends on an attribute are resolved from the props beside them, so `Input({ type: "checkbox", role: "checkbox" })` is reported while `Input({ type: "text", role: "checkbox" })` is not.
