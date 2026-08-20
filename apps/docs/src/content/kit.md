---
title: Kit
description: Skip the wiring — file-based routing, SSR, and prerendering with @implementjs/kit.
section: Building applications
order: 23
---

Everything on the last few pages, the entry, the HMR block, the route tree, is code you can write yourself, and it's worth knowing how it works. But you don't have to write it for every app.

[`@implementjs/kit`](/kit) is the framework's application layer, a Vite plugin in the spirit of [SvelteKit](https://svelte.dev/docs/kit). You put pages and layouts in `src/routes` and kit generates the rest:

```
src/routes
	index.ts          → /
	layout.ts         → wraps everything
	users
		[id]
			index.ts      → /users/:id
```

```ts
// vite.config.ts
import { kit } from "@implementjs/kit";

export default defineConfig({ plugins: [kit()] });
```

In return you get the entry and [router](/docs/router) written for you, typed `params` and `./$types` for every route, server-rendered pages in dev, and a prerendered static site on build. This docs site is built with it.

Kit has [its own docs](/kit), start with the [introduction](/kit) and go from there.
