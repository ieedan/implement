[![npm version](https://img.shields.io/npm/v/@implementjs/adapter-vercel.svg)](https://www.npmjs.com/package/@implementjs/adapter-vercel) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/adapter-vercel.svg)](https://www.npmjs.com/package/@implementjs/adapter-vercel)

# @implementjs/adapter-vercel

Builds an [implement kit](https://implementjs.dev/kit) app for
[Vercel](https://vercel.com), through the
[Build Output API](https://vercel.com/docs/build-output-api/v3).

```sh
npm install -D @implementjs/adapter-vercel
```

```ts
// vite.config.ts
import adapter from "@implementjs/adapter-vercel";
import { kit } from "@implementjs/kit";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [kit({ adapter: adapter() })],
});
```

`vite build` writes `.vercel/output`: everything prerendered as static files on the CDN, and
the app as a bundled Node function behind them for whatever the filesystem misses. Deploy it
with `vercel deploy --prebuilt`. The runtime, regions, memory and max duration are all
options.

Full documentation: [implementjs.dev/kit/adapters](https://implementjs.dev/kit/adapters)
