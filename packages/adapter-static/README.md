[![npm version](https://img.shields.io/npm/v/@implementjs/adapter-static.svg)](https://www.npmjs.com/package/@implementjs/adapter-static) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/adapter-static.svg)](https://www.npmjs.com/package/@implementjs/adapter-static)

# @implementjs/adapter-static

Builds an [implement kit](https://implementjs.dev/kit) app into static files for any static
host.

```sh
npm install -D @implementjs/adapter-static
```

```ts
// vite.config.ts
import adapter from "@implementjs/adapter-static";
import { kit } from "@implementjs/kit";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [kit({ adapter: adapter() })],
});
```

Plain files, nothing running. On top of what a kit build does on its own it adds the options
a static host tends to want, precompressed assets, and a check that fails the build on a
route no file could answer.

For a single page app, turn the prerender off and give the client router a shell to boot
from:

```ts
kit({ prerender: false, adapter: adapter({ fallback: "index.html" }) });
```

Full documentation: [implementjs.dev/kit/adapters](https://implementjs.dev/kit/adapters)
