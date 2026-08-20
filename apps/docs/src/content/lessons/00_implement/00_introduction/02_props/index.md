---
title: Props
description: How to provide properties to components.
section: Introduction
---

If you are going to write actual applications you will need to provide properties to elements.

This can be done by adding an object before the elements children like so:

```ts
Div({} /* children */);
```

Let's use the props array to change the text color of this heading to red.

```ts
H1({ style: { color: "red" } }, "Props");
```
