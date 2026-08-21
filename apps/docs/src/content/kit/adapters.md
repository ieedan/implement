---
title: Adapters
description: Build the app for the place it runs — a static host, a Node server, Vercel, Cloudflare.
section: Guides
order: 16
---

`vite build` on its own writes a static site: pages and `GET` endpoints become files, and anything that has to run when a request arrives — a `POST` endpoint, a webhook, an upload, a load that reads the session — has nowhere to go. An **adapter** is what gives it somewhere.

```ts
// vite.config.ts
import { kit } from "@implementjs/kit";
import adapter from "@implementjs/adapter-node";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [kit({ adapter: adapter() })],
});
```

That is the whole configuration. `vite build` now stages the build under `.implement/output` — the client bundle with everything prerendered into it, plus a second build of the app's request pipeline — and the adapter turns that pair into whatever its host deploys.

Nothing in your app changes when you swap adapters. The same `hooks.server.ts`, the same `server.ts` endpoints, the same loads.

## The adapters

| Package                                          | Deploys to                   | Output                        |
| ------------------------------------------------ | ---------------------------- | ----------------------------- |
| [`@implementjs/adapter-static`](#static)         | any static host              | `dist/`                       |
| [`@implementjs/adapter-node`](#node)             | anywhere Node runs           | `dist/`, run with `node dist` |
| [`@implementjs/adapter-vercel`](#vercel)         | Vercel                       | `.vercel/output/`             |
| [`@implementjs/adapter-cloudflare`](#cloudflare) | Cloudflare Workers and Pages | `dist/`                       |

### Static

Plain files, nothing running. This is what a kit build does with no adapter at all; the package adds the options a static host tends to want, and a check that catches routes that cannot be files.

```ts
import adapter from "@implementjs/adapter-static";

kit({ adapter: adapter() });
```

| Option        | Default         |                                                           |
| ------------- | --------------- | --------------------------------------------------------- |
| `pages`       | `"dist"`        | where the documents go                                    |
| `assets`      | same as `pages` | where everything else goes                                |
| `fallback`    | —               | a document written for every path with no file of its own |
| `precompress` | `false`         | also write `.gz` and `.br` beside each compressible file  |
| `strict`      | `true`          | fail the build on a route nothing prerendered             |

`strict` is the one worth knowing about. A page or endpoint with no file behind it is a 404 in production and silence in the build log, so by default the build stops and names them:

```
@implementjs/adapter-static: nothing prerendered these, and a static host has
no way to answer them:
  page /dashboard
  endpoint /api
```

A single-page app is the same adapter with the prerender off and a shell for the client router to boot from:

```ts
kit({ prerender: false, adapter: adapter({ fallback: "index.html" }) });
```

### Node

A server you run yourself — a container, a VM, a Raspberry Pi.

```ts
import adapter from "@implementjs/adapter-node";

kit({ adapter: adapter() });
```

`vite build` writes `dist/`, and `node dist` serves it: hashed assets with a year-long cache, the pages that prerendered straight off disk, and everything else rendered per request.

Configuration is environment variables, because that is what a container has:

| Variable          | Default             |                                                 |
| ----------------- | ------------------- | ----------------------------------------------- |
| `PORT`            | `3000`              |                                                 |
| `HOST`            | `0.0.0.0`           |                                                 |
| `SOCKET_PATH`     | —                   | listen on a unix socket instead                 |
| `ORIGIN`          | —                   | pin the origin the app thinks it is served from |
| `PROTOCOL_HEADER` | `x-forwarded-proto` |                                                 |
| `HOST_HEADER`     | `host`              |                                                 |
| `ADDRESS_HEADER`  | —                   | where `getClientAddress()` reads from           |
| `XFF_DEPTH`       | `1`                 | how many of your own proxies are in front       |

Behind a reverse proxy, set `ADDRESS_HEADER=x-forwarded-for` so `getClientAddress()` sees the visitor rather than the proxy, and `XFF_DEPTH` to the number of proxies you control — everything before that hop is client-supplied and must not be trusted. `envPrefix` namespaces all of these if bare `PORT` already means something where you deploy.

To mount the app inside a server you already have, use the middleware instead of the entry point:

```js
import { handler } from "./dist/handler.js";

app.use("/", handler);
```

Dependencies stay external, so deploy `dist/` alongside the `node_modules` the app was built with.

### Vercel

```ts
import adapter from "@implementjs/adapter-vercel";

kit({ adapter: adapter() });
```

The build writes [Build Output API v3](https://vercel.com/docs/build-output-api/v3) into `.vercel/output`: the client bundle and everything prerendered as static files on the CDN, the app as a bundled Node function, and a routing table that caches hashed assets forever, serves the filesystem, then falls through to the function. Vercel needs no project settings beyond running `vite build`, and `vercel.json` stays empty.

`runtime` (default `"nodejs22.x"`), `regions`, `memory`, and `maxDuration` are passed through to the function.

### Cloudflare

```ts
import adapter from "@implementjs/adapter-cloudflare";

kit({ adapter: adapter() });
```

The build writes `dist/`: the client bundle and prerendered pages at the root, a `_worker.js` beside them, and a `_routes.json` that keeps the worker out of requests the static assets already answer. Cloudflare Pages deploys that directory as it is; a Workers project points at it:

```jsonc
// wrangler.jsonc
{
	"main": "dist/_worker.js",
	"compatibility_flags": ["nodejs_compat"],
	"assets": { "directory": "dist", "binding": "ASSETS" },
}
```

The worker's bindings reach your routes as `event.platform`, which is how you get at KV, D1, or a queue:

```ts
// src/routes/api/server.ts
export async function POST({ platform, request }: RequestEvent): Promise<Response> {
	await platform!.env.DB.prepare("insert into signups (email) values (?)")
		.bind(await request.text())
		.run();
	return new Response(null, { status: 204 });
}
```

Declare what your project binds in `src/app.d.ts`, the same file `App.Locals` lives in:

```ts
declare global {
	namespace App {
		interface Platform {
			env: { DB: D1Database };
			context: ExecutionContext;
			caches: CacheStorage;
		}
	}
}

export {};
```

The worker is bundled for `workerd` rather than Node, so a dependency that cannot run on workers fails this build instead of the deploy.

## What still prerenders

With no adapter, or with the static one, everything prerenders — it is the only thing a static build can mean, and a load runs once, at build time.

With an adapter that ships a server that would be wrong. A page whose load reads the session or a database must not be frozen at build time, or every visitor gets whatever the build machine saw. So the default changes: **pages with no server load prerender, pages with one are rendered per request, and endpoints wait for the server.**

Routes say otherwise for themselves, by exporting `prerender` from a server file:

```ts
// src/routes/blog/[slug]/page.server.ts
export const prerender = true;

export default async function load({ params }: LoadEvent) {
	return { post: await getPost(params.slug) };
}
```

The nearest declaration wins, so a `layout.server.ts` can prerender a whole section and one page underneath it can opt back out. `kit({ prerender: { default: true } })` sets the default for the whole app either way.

A page that is not prerendered is never rendered during the build at all — the crawl that discovers routes stops at it — so its loads do not run against your database while you build.

## Writing an adapter

An adapter is an object with a name and an `adapt` function. Kit hands it the finished build:

```ts
import type { Adapter } from "@implementjs/kit/adapter";

export default function adapter(): Adapter {
	return {
		name: "my-adapter",
		adapt(builder) {
			builder.copy(builder.clientDir, "build/client");
			builder.copy(builder.serverDir!, "build/server");
		},
	};
}
```

`builder` carries the staged directories, the prerendered paths, the app's route table, and file helpers (`copy`, `writeFile`, `mkdirp`, `rimraf`). `server: false` skips the server build for a host that has nothing to run it with.

Where a host needs its own shape of entry point — a worker's `export default { fetch }`, a platform's request signature — `build.entry` replaces kit's, and imports the app through `$implement/handler`:

```ts
build: {
	bundle: true,
	entry: `
		import { handler } from "$implement/handler";
		export default {
			fetch: (request, env, context) => handler(request, { platform: { env, context } }),
		};
	`,
}
```

The handler is web-standard in and out, with no `node:*` anywhere in its graph. `@implementjs/kit/node` has the `node:http` bridge and the static-file middlewares for hosts that do run Node.
