---
title: Events
description: How to react to events on elements.
section: Introduction
---

If you want your UI to update based on user interactions you will also need to know how to respond to events.

Events can be accessed from the component props object:

```ts
Button(
    { 
        onClick: () => alert('Clicked!') 
    },
    "Click me"
);
```

Try it yourself!
