# Adapters

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

That is the whole configuration. `vite build` stages the build under `.implement/output` — the client bundle with everything prerendered into it, plus a second Vite build of the app's request pipeline — and the adapter turns that pair into what its host deploys. The server build runs on the same config as the client one, so plugins, aliases, and env replacement apply to both.

Nothing in the app changes when you swap adapters. The same `hooks.server.ts`, the same `server.ts` endpoints, the same loads.

| Package                           | Deploys to                   | Output                        |
| --------------------------------- | ---------------------------- | ----------------------------- |
| `@implementjs/adapter-static`     | any static host              | `dist/`                       |
| `@implementjs/adapter-node`       | anywhere Node runs           | `dist/`, run with `node dist` |
| `@implementjs/adapter-vercel`     | Vercel                       | `.vercel/output/`             |
| `@implementjs/adapter-cloudflare` | Cloudflare Workers and Pages | `dist/`                       |

## What still prerenders

With no adapter, or with the static one, everything prerenders — it is the only thing a static build can mean, and a load runs once, at build time.

With an adapter that ships a server that would be wrong: a page whose load reads the session or a database must not be frozen at build time, or every visitor gets whatever the build machine saw. So the default changes. **Pages with no server load prerender, pages with one are rendered per request, and endpoints wait for the server.**

Routes say otherwise for themselves, by exporting `prerender` from a server file — `page.server.ts`, `layout.server.ts`, or an endpoint's `server.ts`:

```ts
// src/routes/blog/[slug]/page.server.ts
export const prerender = true;

export default async function load({ params }: LoadEvent) {
	return { post: await getPost(params.slug) };
}
```

The nearest declaration to the page wins, so a `layout.server.ts` can prerender a whole section and one page underneath it can opt back out. `kit({ prerender: { default: true } })` sets the default for the whole app either way, and `kit({ prerender: false })` turns the prerender off entirely.

A page that is not prerendered is never rendered during the build at all — the crawl that discovers routes stops at it — so its loads never run against your database while you build.

## `@implementjs/adapter-static`

Plain files, nothing running. This is what a kit build does with no adapter; the package adds the options a static host tends to want, and a check that catches routes that cannot be files.

| Option        | Default         |                                                           |
| ------------- | --------------- | --------------------------------------------------------- |
| `pages`       | `"dist"`        | where the documents go                                    |
| `assets`      | same as `pages` | where everything else goes                                |
| `fallback`    | —               | a document written for every path with no file of its own |
| `precompress` | `false`         | also write `.gz` and `.br` beside each compressible file  |
| `strict`      | `true`          | fail the build on a route nothing prerendered             |

`strict` is the one worth knowing about. A page or endpoint with no file behind it is a 404 in production and silence in the build log, so the build stops and names them. A `fallback` turns the check off on its own — with one, the client router answers whatever the build has no document for:

```ts
kit({ prerender: false, adapter: adapter({ fallback: "index.html" }) });
```

## `@implementjs/adapter-node`

`vite build` writes `dist/`, and `node dist` serves it: hashed assets with a year-long cache, prerendered pages straight off disk, everything else rendered per request.

Configuration is environment variables: `PORT` (3000), `HOST` (`0.0.0.0`), `SOCKET_PATH`, `ORIGIN`, and behind a proxy `PROTOCOL_HEADER` (`x-forwarded-proto`), `HOST_HEADER` (`host`), `ADDRESS_HEADER`, and `XFF_DEPTH` (1). Set `ADDRESS_HEADER=x-forwarded-for` and `XFF_DEPTH` to the number of proxies you control so `getClientAddress()` sees the visitor rather than the proxy — everything before that hop is client-supplied and must not be trusted. The adapter's `envPrefix` option namespaces all of them.

`dist/handler.js` exports the same pipeline as a connect-style middleware, for mounting the app inside an Express or Polka server you already have:

```js
import { handler } from "./dist/handler.js";

app.use(handler);
```

Dependencies stay external, so `dist/` is deployed alongside the `node_modules` the app was built with.

## `@implementjs/adapter-vercel`

Writes [Build Output API v3](https://vercel.com/docs/build-output-api/v3) into `.vercel/output`: the client bundle and everything prerendered as static files on the CDN, the app as a bundled Node function, and a routing table that caches hashed assets forever, serves the filesystem, then falls through to the function. Vercel needs no project settings beyond running `vite build`.

`runtime` (default `"nodejs22.x"`), `regions`, `memory`, and `maxDuration` pass through to the function.

## `@implementjs/adapter-cloudflare`

Writes `dist/`: the client bundle and prerendered pages at the root, a `_worker.js` beside them, and a `_routes.json` keeping the worker out of requests the static assets already answer. Cloudflare Pages deploys the directory as it is; a Workers project points at it:

```jsonc
// wrangler.jsonc
{
	"main": "dist/_worker.js",
	"compatibility_flags": ["nodejs_compat"],
	"assets": { "directory": "dist", "binding": "ASSETS" },
}
```

The worker's bindings reach routes as `event.platform`:

```ts
export async function POST({ platform, request }: RequestEvent): Promise<Response> {
	await platform!.env.DB.prepare("insert into signups (email) values (?)")
		.bind(await request.text())
		.run();
	return new Response(null, { status: 204 });
}
```

Declare what the project binds in `src/app.d.ts`, beside `App.Locals`:

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

The worker is bundled for `workerd` rather than Node, so a dependency that cannot run on workers fails the build instead of the deploy.

## Writing one

An adapter is an object with a name and an `adapt` function:

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

`builder` carries the staged directories, the prerendered paths, the app's route table, and file helpers (`copy`, `writeFile`, `mkdirp`, `rimraf`). `server: false` skips the server build for a host with nothing to run it with.

Where a host needs its own shape of entry point, `build.entry` replaces kit's and imports the app through `$implement/handler`:

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

`entry` may also be a function of the finished build, for glue that has to carry a fact only the build knows. The handler is web-standard in and out, with no `node:*` anywhere in its graph; `@implementjs/kit/node` has the `node:http` bridge and the static-file middlewares for hosts that do run Node.
