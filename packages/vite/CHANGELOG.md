# @implementjs/vite

## 0.0.3

### Patch Changes

- [#80](https://github.com/ieedan/implement/pull/80) [`e9e3451`](https://github.com/ieedan/implement/commit/e9e3451627bf62f9407b3793b0a598d7738a4b2a) Thanks [@ieedan](https://github.com/ieedan)! - `api.openapi.output` writes its file whatever `prerender` is set to.

  The document was written from inside the prerender pass's `after` hook, which is
  never reached with `prerender: false`. An app that turned prerendering off got
  no file, no warning, and a build that still exited 0 — and `prerender: false` is
  the normal setting for an app whose pages sit behind a session, which is exactly
  the kind of app that wants a documented API.

  `@implementjs/vite` grows a `build` hook that runs with the SSR module runner
  open, ahead of the prerender and whether or not there is one, and kit writes the
  document from there. The runner is opened for that hook alone when prerendering
  is off, so a build with no document to write pays nothing for it. Route data
  payloads and prerendered endpoints still come from `after`, which is where they
  belong: those _are_ the prerender's output.

  ```ts
  kit({
  	adapter: adapter(),
  	prerender: false,
  	api: {
  		openapi: { info: { title: "x", version: "1" }, output: "static/openapi.json" },
  	},
  });
  ```

  `vite build` now writes `static/openapi.json`, copies it into the build's own
  output when `output` lands under the public dir, and names it to the adapter
  alongside everything else the build produced.

## 0.0.2

### Patch Changes

- [`a8d5286`](https://github.com/ieedan/implement/commit/a8d528668fb5ac32d63d9e36fad3a81a632e04c5) Thanks [@ieedan](https://github.com/ieedan)! - Adds two env files the running server reads instead of the build: `src/lib/env.dynamic.server.ts` and `src/lib/env.dynamic.public.ts`.

  `env.public.ts` and `env.server.ts` are evaluated once during `vite build` and re-emitted as literals, which is the right default and stays the default: the schemas cost the bundle nothing and a missing variable fails the build rather than the deploy. It also means rotating a secret is a rebuild and a redeploy, and the artifact you shipped holds the value. The escape hatch was bare `process.env` in the route, which gives up the validation and the types that were the point of `defineEnv`.

  `defineDynamicEnv`, from the new `@implementjs/kit/env` entry, declares the same kind of schema map and hands back the same `typeof env` — but as a live view rather than a snapshot:

  ```ts
  // src/lib/env.dynamic.server.ts
  import { defineDynamicEnv } from "@implementjs/kit/env";
  import * as v from "valibot";

  export const env = defineDynamicEnv({
  	BETTER_AUTH_SECRET: v.string(),
  	SESSION_TTL: v.pipe(v.string(), v.transform(Number), v.number()),
  });
  ```

  The first read validates every key at once, reporting all the failures together the way a build does, and caches the result until the environment underneath is replaced. So a read costs a property lookup, `SESSION_TTL` still arrives as a `number`, and rotating `BETTER_AUTH_SECRET` is a restart.

  Three things follow from reading at runtime, and they are the reason this is a separate file rather than a flag on the other one. `vite build` no longer fails on a variable it declares — there is nothing to validate against yet, so the first read on the running server throws instead. The schemas ship, because kit cannot replace this file with literals; the file and the schema library are part of the server bundle. And prerendering reads the build's environment, because that is the only one a prerender has, so a page that prerenders a dynamic value bakes it in.

  What reaches the browser does not change. The file is a `*.server.ts` under the existing guard: a client import fails the build with the importer chain, and the client copy is the same throwing stub with no values in it. That name is not free-form — `kit({ env: { dynamic } })` refuses a path that is not `*.server.ts`, because for the one file kit does not rewrite, the name is the only thing keeping it out of a bundle. `PUBLIC_` is refused here as it is in `env.server.ts`, and caught when the module evaluates rather than on the first read.

  Values come from `.env` in dev and while prerendering, and from `process.env` on a built server — so Node and Vercel need nothing. A worker has no `process.env`, so `@implementjs/adapter-cloudflare` now calls `setDynamicEnv(env)` with the bindings each request arrives with; the same function is exported for a hand-rolled host. On a worker the environment does not exist until the first request, so read these values inside a load, an endpoint or a hook rather than at the top level of a module.

  ## Public values, without shipping the schemas

  `src/lib/env.dynamic.public.ts` is the same idea for values the browser needs. Every key must start with `PUBLIC_`, as in `env.public.ts`:

  ```ts
  // src/lib/env.dynamic.public.ts
  import { defineDynamicPublicEnv } from "@implementjs/kit/env";
  import * as v from "valibot";

  export const env = defineDynamicPublicEnv({
  	PUBLIC_API_URL: v.pipe(v.string(), v.url()),
  	PUBLIC_UPLOAD_LIMIT: v.pipe(v.string(), v.transform(Number), v.number()),
  });
  ```

  The `defineDynamicPublicEnv` call never runs in a browser. Kit replaces the module in the client graph with a reader over the values the page is carrying — already validated, already coerced, so `PUBLIC_UPLOAD_LIMIT` arrives as a `number` — so neither the schemas nor the schema library are in the client bundle. That is the promise `env.public.ts` makes, kept for a value that is not known until a request. The values ride in the document kit renders, beside the route data, as `<script type="application/json" data-implement-env>`.

  A prerendered page was written before there was a request, so it carries no current values. An app with an adapter that serves gets a module first in the document's `<head>` — `<script type="module" src="/_implement/env.js">`, which module ordering alone guarantees runs before the app's entry and anything it imports. An app that is static, or whose adapter serves nothing, keeps the build's values instead, exactly as `env.public.ts` would, because nothing is running that could offer fresher ones.

  That boot module is a round trip in front of hydration, on every prerendered page. It is the price of a public value that is not baked in, and it is why this is a file rather than a flag: **an app that does not create the file pays none of it.** The generated server entry imports the module only when it is there, so there is no snapshot in any page, no `/_implement/env.js` route on the server, and no reader in the client bundle.

  ## Also

  The kit plugin entry is now excluded from Vite's dependency pre-bundling. `@implementjs/kit` imports vite and esbuild, the env files import it for `defineEnv`, and kit replaces those modules wholesale long before a bundle is written — but an optimizer that reached one first would try to prebundle a bundler for a browser.

## 0.0.1

### Patch Changes

- [`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed) Thanks [@ieedan](https://github.com/ieedan)! - initial setup
