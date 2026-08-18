---
title: Elements
description: Build a tree with element factories and children.
section: Introduction
order: 1
---

Every HTML tag has a factory: `Div`, `H1`, `P`, `Button`, `Input`, and so on. The first argument can be a props object; everything after that is children.

```ts
Div({ class: "card" }, H1("Title"), P("Body"));
```

Props are optional. `Div(H1("Title"))` is fine.

Add a short paragraph under the heading, then a button labeled `Next`. The preview styles the native elements for you, so you can stay focused on the tree.
