---
title: Custom nodes
description: Build your own control-flow nodes on the public API — swappable regions with Outlet, and a router in twenty lines.
section: Building applications
order: 20.5
---

Everything you mount is a `Mountable` — a function returning `{ mount, unmount, getFirstDomNode }`. Elements are mountables, so are `If`, `ForEach`, and your own components. Nothing about the [router](/docs/router) is privileged: it is a node that swaps what it shows when the URL changes, built out of the same parts you have.

The part you cannot write by hand is mounting children. Core links a child to its parent as it mounts it, and that link is what makes [context](/docs/context) lookups find their provider, errors find their [boundary](/docs/boundary), and the same code work under a server render or a hydration pass. A node that calls `child.mount(parent)` itself skips the link and cuts its subtree off from all three.

`Outlet` is that piece, published. It owns a region of the tree and mounts whatever you `set` into it, properly.

## Outlet

An outlet renders the children it was created with, and `set` replaces them:

```ts
import { Div, Outlet, P } from "@implementjs/core";

const outlet = Outlet(P("Loading…"));

const page = Div({ class: "shell" }, outlet);

load().then((data) => outlet.set(Report(data)));
```

`set` unmounts the previous children before mounting the new ones, so their subscriptions and effects end first. Calling it before the outlet mounts stores the children for when it does — the region does not have to be on screen to be filled.

The outlet keeps its place among its siblings. Children mount where the outlet sits, not at the end of the parent, so `Div(Header(), outlet, Footer())` stays in that order however many times you swap the middle.

Children mounted by `set` are ordinary children of the tree:

- `Use()` finds a provider declared above the outlet.
- An error thrown while they mount reaches the nearest `ImplementBoundary`.
- `renderToString` serializes whatever is set at render time.

The one thing to know: `set` mounts synchronously and rethrows what the children throw. During the outlet's own mount that lands in the enclosing boundary like any other mount error, but a `set` you make later — from a subscription, a promise, an event — hands the error back to you. Catch it and set something else, the way a router shows its fallback.

> [!TIP]
> `set` is imperative on purpose: the outlet decides _when_ to swap. For content that follows a signal, [`If`](/docs/if), [`Switch`](/docs/switch), and [`ForEach`](/docs/foreach) already do this and read better.

## The current location

`location` is a `Readable<RouterLocation>` of `{ path, search, hash }`, updated by every navigation including back and forward. It is the same value `router.location` hands you, exported on its own so a node that is not the router can follow the URL:

```ts
import { location, navigateTo } from "@implementjs/core";

const onSettings = derived([location], (l) => l.path.startsWith("/settings"));
```

Reads defer to whatever location is active when you make them, so a module-scope `location` touches neither `window` nor the browser history until something subscribes — a server render installs its own for the duration of the render, and it wins.

Writes go through `navigateTo`, which moves the history entry alongside the value. Subscribing also arms scroll restoration: the position of the entry a reload landed on is restored right after the first render, whoever it was that subscribed.

## A router in twenty lines

That is enough to write one:

```ts
import {
	Fragment,
	ImplementEffect,
	location,
	Outlet,
	type Child,
	type RouterLocation,
} from "@implementjs/core";

export function MiniRouter(routes: Record<string, () => Child>, notFound: () => Child): Child {
	const outlet = Outlet();

	const show = ({ path }: RouterLocation) => {
		const render = routes[path] ?? notFound;
		try {
			outlet.set(render());
		} catch (error) {
			console.error(error);
			outlet.set(notFound());
		}
	};

	// the effect follows the location for as long as the router is mounted, and
	// runs once on mount — so the first match is set before the outlet renders
	return Fragment(ImplementEffect([location], show), outlet);
}
```

```ts
app.render(
	MiniRouter(
		{
			"/": () => Home(),
			"/about": () => About(),
		},
		() => P("Not found"),
	),
);
```

`ImplementEffect` subscribes on mount and unsubscribes on unmount, so the subscription's lifetime is the node's — there is no cleanup to write. `Fragment` groups the two without a wrapper element.

This mounts under `App`, serializes through `renderToString`, hydrates, restores scroll on reload, and resolves context and error boundaries — none of which it had to ask for. The built-in `Router` is this plus route matching, params as signals, and an outlet per layout so navigating between siblings swaps only the child.

## Nesting outlets

Layouts are just outlets handed to someone else. A layout takes a child mountable and puts it wherever it wants:

```ts
const shell = Outlet();
const page = Outlet();

shell.set(Div({ class: "sidebar-layout" }, Sidebar(), page));

// later: swap the page without touching the layout
page.set(Settings());
```

Because the layout's own children never unmount, its state — a scroll position, an open menu, a running animation — survives the swap. That is the whole trick behind persistent layouts.

With routing covered from both sides, all that's left is running and shipping the thing, which is where [Vite](/docs/vite) comes in.
