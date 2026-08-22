# @implementjs/router

The typed route-tree router for [implement](https://github.com/ieedan/implement). One nested object
describes the whole app: keys are path segments, `:param` segments surface as signals at every
render below them, `"/"` renders a level, and `layout` wraps everything beneath it.

```ts
import { App } from "@implementjs/core";
import { Router } from "@implementjs/router";

const router = Router(
	{
		"/": () => Home(),
		"/issues": {
			layout: (child) => Shell(child),
			"/": () => Issues(),
			"/:id": ({ id }) => Issue({ id }),
		},
	},
	{ fallback: (error) => NotFound(error) },
);

App({ target: document.body }).render(router);

router.Link({ to: "/issues/:id", params: { id: "42" } }, "Open #42");
router.navigate("/issues");
router.href("/issues/:id", { id: 42 });
```

Navigating between children of a shared layout swaps only the child; navigating between params of
the same route patches the param signals in place without remounting.

## What lives where

The router owns matching, `Router`, `Link`, and the path typing behind `href`/`navigate`. The
current location and everything that moves it stay in `@implementjs/core`:

```ts
import { location, navigateTo, registerNavigationGuard, searchParam } from "@implementjs/core";
```

That split is deliberate. This package is written against core's public API and nothing else — no
private subpath, no internal imports — so anything it does, a router you write yourself can do too.
See the [custom nodes](https://implementjs.dev/docs/custom-nodes) page for the surface it uses:
`Outlet` for the swappable region, `location` for the URL, `ImplementEffect` for the subscription.

Full documentation: <https://implementjs.dev/docs/router>
