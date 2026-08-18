---
title: Binding signals
description: How to bind signals to update properties
section: Signals
---

To update properties of components you will need to know how to bind signals.

There are two types of bindings that you will need to use, **Readable**, and **Writable**.

**Readable** bindings allow the component to read your signal but don't allow it to write to it; For example `class`. **Writable** bindings allow the component to read and write to your signal; For example `value`.

Let's bind `name` to the value of this input so that we can update it:

```ts
Input({ value: name, placeholder: "Enter your name" });
```

That's good but we can't be sure that it's working so let's display "My name is: <name>" in the UI.

We can do this by creating a **Readable** binding to the content of a `P` element.

To do this let's first learn about the `.bind()` method on a signal. The `.bind()` method allows us to remap the value of a signal for use in a binding.

This feature is useful for object typed signals because it allows us to access `.` properties.

In this case let's us it to construct a template string to display in the UI:

```ts
P(name.bind((name) => `Hello my name is, ${name}!`));
```

> This isn't the only (or even the best way) to do this but it works for demonstrating how you can use `.bind()`

Bind can also be used to create **Writable** bindings by passing a setter function as the second argument. For example if we wanted the users name to always be uppercase:

```ts
Input({
	value: name.bind(
		(name) => name,
		(prev, next) => {
			prev = next.toUpperCase()
			return prev
		}
	),
}),
```
