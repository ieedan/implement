[![npm version](https://img.shields.io/npm/v/@implementjs/vite.svg)](https://www.npmjs.com/package/@implementjs/vite) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/vite.svg)](https://www.npmjs.com/package/@implementjs/vite)

# @implementjs/vite

The [Vite](https://vite.dev) plugin behind [implement](https://implementjs.dev)'s server
rendering, prerendering and dev styles.

```sh
npm install -D @implementjs/vite
```

Most apps never install this directly. [`@implementjs/kit`](https://implementjs.dev/kit)
depends on it and configures it for you. Reach for it when you are building your own
routing on top of implement and want the SSR dev server, the crawler and the prerenderer
without kit's conventions.

```ts
// vite.config.ts
import { implement } from "@implementjs/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [implement({ entry: "/src/entry-server.ts" })],
});
```

The entry module exports `render(url)`, and the plugin injects what it returns into the
html shell: server rendered in dev, written to disk on build.

Full documentation: [implementjs.dev/docs/vite](https://implementjs.dev/docs/vite)
