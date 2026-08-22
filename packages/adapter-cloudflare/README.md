[![npm version](https://img.shields.io/npm/v/@implementjs/adapter-cloudflare.svg)](https://www.npmjs.com/package/@implementjs/adapter-cloudflare) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/adapter-cloudflare.svg)](https://www.npmjs.com/package/@implementjs/adapter-cloudflare)

# @implementjs/adapter-cloudflare

Builds an [implement kit](https://implementjs.dev/kit) app into a
[Cloudflare](https://developers.cloudflare.com/workers/) worker with static assets beside
it.

```sh
npm install -D @implementjs/adapter-cloudflare
```

```ts
// vite.config.ts
import adapter from "@implementjs/adapter-cloudflare";
import { kit } from "@implementjs/kit";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [kit({ adapter: adapter() })],
});
```

`vite build` writes the worker and its assets into `dist/`, with a `_routes.json` that keeps
the hashed asset directory away from the worker so static files are served without waking
it.

Full documentation: [implementjs.dev/kit/adapters](https://implementjs.dev/kit/adapters)
