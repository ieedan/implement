[![npm version](https://img.shields.io/npm/v/@implementjs/adapter-iis.svg)](https://www.npmjs.com/package/@implementjs/adapter-iis) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/adapter-iis.svg)](https://www.npmjs.com/package/@implementjs/adapter-iis)

# @implementjs/adapter-iis

Builds an [implement kit](https://implementjs.dev/kit) app for [IIS](https://learn.microsoft.com/iis/) on
Windows Server.

```sh
npm install -D @implementjs/adapter-iis
```

```ts
// vite.config.ts
import adapter from "@implementjs/adapter-iis";
import { kit } from "@implementjs/kit";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [kit({ adapter: adapter({ origin: "https://intranet.example.com" }) })],
});
```

`vite build` writes `dist/`: the app as a Node server, the client bundle beside it, and the
`web.config` that tells IIS to start the one and hand it every request. Copy the directory to the
server, point a site at it, and it runs.

IIS does not run JavaScript itself, so the server needs one of two modules installed:

- [**HttpPlatformHandler**](https://learn.microsoft.com/iis/extensions/httpplatformhandler/httpplatformhandler-configuration-reference)
  — Microsoft's own, still supported, and the default.
- [**iisnode**](https://github.com/Azure/iisnode) with
  [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite) — what most existing
  IIS-and-Node servers already have, and `adapter({ hosting: "iisnode" })`.

Full documentation: [implementjs.dev/kit/adapters](https://implementjs.dev/kit/adapters)
