---
title: Two-way inputs
description: Bind a form control to a signal with the value prop.
section: Bindings
order: 4
---

Pass a writable signal to an input's `value` and the binding goes both ways. Typing updates the signal; setting the signal updates the input.

```ts
const name = signal("");

Input({ value: name, placeholder: "Your name" });
```

Bind the input to `name` and render that same signal in the paragraph so you can see it update as you type.
