---
title: Elements
description: How to create elements with implement.
section: Introduction
---

Implement is unique from most other modern web frameworks because it doesn't rely on a templating language for you to write html markup.

This way we can build apps without needing a compiler or any additional language tooling.

Because of this implement forces you to write your markup a little bit differently, with functions.

Every html tag is a function with props and children. Because of this you will need to import these elements from `@implementjs/core` before using them. 

> In these lessons we have opted to include the imports you will need in the boilerplate so that you don't need to import them every time.

Let's use this knowledge to build this example into a basic hero section with a short description and a CTA.

```ts
export default function App() {
    return Div(H1("Elements"), P("Factories build real DOM nodes."), Button("Next"));
}
```
