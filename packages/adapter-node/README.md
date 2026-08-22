[![npm version](https://img.shields.io/npm/v/@implementjs/adapter-node.svg)](https://www.npmjs.com/package/@implementjs/adapter-node) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/adapter-node.svg)](https://www.npmjs.com/package/@implementjs/adapter-node)

# @implementjs/adapter-node

Builds an [implement kit](https://implementjs.dev/kit) app into a standalone Node server.

```sh
npm install -D @implementjs/adapter-node
```

```ts
// vite.config.ts
import adapter from "@implementjs/adapter-node";
import { kit } from "@implementjs/kit";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [kit({ adapter: adapter() })],
});
```

`vite build` writes a server and its assets into `dist/`. Run it with `node dist`. It reads
`PORT` and `HOST` from the environment, under a prefix of your choosing if bare ones are
already spoken for.

Full documentation: [implementjs.dev/kit/adapters](https://implementjs.dev/kit/adapters)
