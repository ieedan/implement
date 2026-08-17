---
title: Getting Started
description: How to get started with implement.
order: 1
---


```ts
import { App, Button, Div, signal } from "@packages/implement";

const app = App({ target: document.body });

function Counter() {
	const count = signal(0);

	return Div(
		Button({ onClick: () => count.update((n) => n + 1) }, "Count: ", count),
	);
}

app.render(Counter());
```
