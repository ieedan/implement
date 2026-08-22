[![npm version](https://img.shields.io/npm/v/@implementjs/kit.svg)](https://www.npmjs.com/package/@implementjs/kit) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/kit.svg)](https://www.npmjs.com/package/@implementjs/kit)

# @implementjs/kit

File based routing, server rendering and prerendering for [implement](https://implementjs.dev)
apps, on top of [Vite](https://vite.dev). You write pages and layouts as files in
`src/routes` and kit wires up the router with typed params.

```sh
npm install -D @implementjs/kit
```

```ts
// vite.config.ts
import { kit } from "@implementjs/kit";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [kit()],
});
```

kit has no runtime of its own. What ships to the browser is the same `@implementjs/core`
router you could have written by hand, generated from the files on disk.

A build prerenders every route it can reach. Pair it with an adapter to deploy a server
instead:

| Adapter                           | Target                                    |
| --------------------------------- | ----------------------------------------- |
| `@implementjs/adapter-node`       | A standalone Node server                  |
| `@implementjs/adapter-static`     | Static files for any static host          |
| `@implementjs/adapter-vercel`     | Vercel, through the Build Output API      |
| `@implementjs/adapter-cloudflare` | A Cloudflare worker with assets beside it |

Full documentation: [implementjs.dev/kit](https://implementjs.dev/kit)
