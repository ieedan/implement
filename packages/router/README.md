[![npm version](https://img.shields.io/npm/v/@implementjs/router.svg)](https://www.npmjs.com/package/@implementjs/router) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/router.svg)](https://www.npmjs.com/package/@implementjs/router)

# @implementjs/router

The typed route-tree router for [implement](https://implementjs.dev). One nested object
describes the whole app: keys are path segments, `:param` segments surface as signals at
every render below them, `"/"` renders a level and `layout` wraps everything beneath it.

```sh
npm install @implementjs/router
```

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
```

`Link`, `href` and `navigate` are typed against the tree, so a path that does not exist —
or one whose params you forgot — is a compile error. Navigating between children of a
shared layout swaps only the child; navigating between params of the same route patches the
param signals in place without remounting.

## What lives where

The router owns matching, `Router`, `Link` and the path typing behind `href`/`navigate`. The
current location and everything that moves it stay in `@implementjs/core`:

```ts
import { location, navigateTo, registerNavigationGuard, searchParam } from "@implementjs/core";
```

That split is deliberate. This package is written against core's public API and nothing
else — no private subpath, no internal imports — so anything it does, a router you write
yourself can do too. `Outlet` is the swappable region, `location` is the URL and
`ImplementEffect` is the subscription; see
[custom nodes](https://implementjs.dev/docs/custom-nodes) for the whole surface.

Full documentation: [implementjs.dev/docs/router](https://implementjs.dev/docs/router)
