---
title: Computed values
description: Derive a read-only value from other signals.
section: Signals
---

Sometimes you will need to compute a value based on another value. For this you can use `derived()`.

Here we have the classic counter example and we want to double the count.

We can do this by adding a new derived value `doubled` like so:

```ts
const doubled = derived([count], (count) => count * 2);
```

You might notice for single values this is very similar to the `.bind()` method we discussed in the previous lesson in fact the same thing could be accomplished by writing:

```ts
const doubled = count.bind((count) => count * 2);
```

What `derived()` is more useful for is for computing a value based on multiple other signals.

We could expand this example to have a `multiplyBy` that multiples the count signal by another signal to compute our new "Computed" value:

```ts
export default function App() {
	const count = signal(1);
	const multiplyBy = signal(2);
	const computed = derived([count, multiplyBy], (count, x) => count * x);

	return Div(
		H1("Derived"),
		P("Count: ", count),
		Div(
			Label({ for: "multiply-by" }, "Multiply By"),
			Input({ value: multiplyBy, placeholder: "2", id: "mutiply-by" }),
		),
		P("Computed: ", computed),
		Button({ onClick: () => count.increment() }, "Increment"),
	);
}
```
