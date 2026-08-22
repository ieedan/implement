# Lifecycle

You will inevitabily need to know when a component is mounted, and unmounted. Implement provides `ImplementLifecycle` to help you with this. Unlike other frameworks, implement doesn't have a way of knowing about the lifecycle without actually hooking into the component tree. So you need to mount `ImplementLifecycle` into your component tree.

```ts
import { Div, ImplementLifecycle } from "@implementjs/core";

export default function Page() {
	return ImplementLifecycle(
		{
			onMount: () => {
				console.log("Component mounted");
			},
			onUnmount: () => {
				console.log("Component unmounted");
			},
		},
		Div("Hello, World!"), // mount your children here
	);
}
```

`onMount` receives the parent element and is deferred a microtask, so the subtree is connected to the document by the time it runs and it's safe to focus or measure. `onUnmount` runs synchronously at the start of unmount, while the children are still in the DOM.

Mounted with no children it renders nothing and tracks its own lifecycle:

```ts
ImplementLifecycle({ onMount: (parent) => parent.querySelector("input")?.focus() });
```

Use onUnmount to clean up any resources you may have allocated like signal subscriptions or event listeners. You can also return a cleanup function from onMount to clean up any resources you may have allocated:

```ts
import { Div, ImplementLifecycle } from "@implementjs/core";

export default function Page() {
	return ImplementLifecycle(
		{
			onMount: () => {
				console.log("Component mounted");

				return () => {
					console.log("Component unmounted");
				};
			},
		},
		Div("Hello, World!"), // mount your children here
	);
}
```

Since `subscribe` and `onChange` return their unsubscribe function, a single subscription collapses to `onMount: () => query.onChange(refetch)`. If all you want is to watch some signals, reach for [`ImplementEffect`](./SIGNALS.md#watching-for-changes) instead — it cleans up after itself.

You can cleanup event listeners here but you probably don't want to clean them up in the first place. So when you are listening to events from the document or window you should use `ImplementDocument` or `ImplementWindow` instead these will automatically clean up the event listeners when the component is unmounted.

```ts
import { Fragment, ImplementDocument, ImplementWindow } from "@implementjs/core";

export default function Page() {
	return Fragment(
		// the listeners will be cleaned up automatically when the component is unmounted
		ImplementDocument({
			onKeydown: (event) => {
				if (event.key === "Escape") {
					console.log("Escape key pressed");
				}
			},
		}),
		ImplementWindow({
			onScroll: () => console.log("Scrolled"),
		}),
	);
}
```

Both render nothing, and `on*Capture` listens in the capture phase.
