---
title: Updating the DOM
description: Update the DOM using signals.
section: Signals
---

Now that we know how create and update signals we should probably learn how to bind them so that our UI can update when they change. The most simple way to see a signal update is just to add it directly as the child of a component like so:

```ts
export default function App() {
	const count = signal(0);

	return P(count);
}
```

`P` subscribes to `count` so that whenever `count` updates the content of `P` will too.

To demonstrate this, why don't we use the button onClick event to update the value of our count.

```ts
function handleClick() {
    count.increment();
}
```
