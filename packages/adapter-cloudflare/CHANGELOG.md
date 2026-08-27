# @implementjs/adapter-cloudflare

## 0.0.16

### Patch Changes

- Updated dependencies [[`c3136ff`](https://github.com/ieedan/implement/commit/c3136ff24c5cdbda4aad32fc5662f909aeed8887), [`589641f`](https://github.com/ieedan/implement/commit/589641fc1e8bbea1b732e12db8953cb9868bb5b5)]:
  - @implementjs/kit@0.0.16

## 0.0.15

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.15

## 0.0.14

### Patch Changes

- Updated dependencies [[`a966956`](https://github.com/ieedan/implement/commit/a966956b4ea83998980e725adde89d78ee98d6a4), [`b2c045b`](https://github.com/ieedan/implement/commit/b2c045be858f13f1a059fd9316f3e915445fb10e), [`d8941a0`](https://github.com/ieedan/implement/commit/d8941a07d33300fbd9cddd63ac915d184ea5ef72), [`e9e3451`](https://github.com/ieedan/implement/commit/e9e3451627bf62f9407b3793b0a598d7738a4b2a)]:
  - @implementjs/kit@0.0.14

## 0.0.13

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

- Updated dependencies [[`ad05ed6`](https://github.com/ieedan/implement/commit/ad05ed61f02f76235fd696d7227eab15e3443ea6), [`a8d5286`](https://github.com/ieedan/implement/commit/a8d528668fb5ac32d63d9e36fad3a81a632e04c5), [`b0a4d26`](https://github.com/ieedan/implement/commit/b0a4d264717f2c86b638fe8341b78ffebd93d1eb), [`cb2dffb`](https://github.com/ieedan/implement/commit/cb2dffb0053a570bf39992b81a290dcc5970596c), [`1db158e`](https://github.com/ieedan/implement/commit/1db158e951f0bf07d63681a153f7e1d972905ac4), [`a8d5286`](https://github.com/ieedan/implement/commit/a8d528668fb5ac32d63d9e36fad3a81a632e04c5)]:
  - @implementjs/kit@0.0.13

## 0.0.12

### Patch Changes

- Updated dependencies [[`090e305`](https://github.com/ieedan/implement/commit/090e305ad38d9c299ea20b99ff2a77bba0754cd3)]:
  - @implementjs/kit@0.0.12

## 0.0.11

### Patch Changes

- Updated dependencies [[`dc8afec`](https://github.com/ieedan/implement/commit/dc8afec501579ce02c509d21252a94da9935211d)]:
  - @implementjs/kit@0.0.11

## 0.0.10

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.10

## 0.0.9

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.9

## 0.0.8

### Patch Changes

- Updated dependencies [[`2702c55`](https://github.com/ieedan/implement/commit/2702c55c546c2a82a3517ff997aad4628e203b70), [`05d9b20`](https://github.com/ieedan/implement/commit/05d9b20ead7c52f3eba9fdbaff03363a7b81f8b3)]:
  - @implementjs/kit@0.0.8

## 0.0.7

### Patch Changes

- Updated dependencies [[`e9bf3b1`](https://github.com/ieedan/implement/commit/e9bf3b1e2919f8518248ad3804f310f8a15a2878), [`b51e829`](https://github.com/ieedan/implement/commit/b51e8295af17c8d72287b71e6e312c50bcc12c4f)]:
  - @implementjs/kit@0.0.7

## 0.0.6

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [[`c4cdbfd`](https://github.com/ieedan/implement/commit/c4cdbfd9590eda1e8df1ae1c3c241c98cd6b8b15), [`3752116`](https://github.com/ieedan/implement/commit/3752116f9afa8da206ea2c40bd27db7b0935cba1), [`4c3c44e`](https://github.com/ieedan/implement/commit/4c3c44ea5ce6ac7a084a7c15a3330dd3f287f692)]:
  - @implementjs/kit@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [[`96c8eb9`](https://github.com/ieedan/implement/commit/96c8eb97aa3a1c5fe234f1c5ab068411476f5cdb)]:
  - @implementjs/kit@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.2

## 0.0.1

### Patch Changes

- [`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed) Thanks [@ieedan](https://github.com/ieedan)! - initial setup

- [#32](https://github.com/ieedan/implement/pull/32) [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66) Thanks [@ieedan](https://github.com/ieedan)! - Publish the node-authoring API and extract the router.

  `@implementjs/core` gains `Outlet`, a swappable mount region whose children are mounted
  through core — so context lookups, error boundaries, hydration and server rendering all
  work inside one — and `location`, the current `RouterLocation` as a `Readable`. Core also
  restores the scroll position of the entry a reload landed on off the first location
  subscription, so a hand-written router gets that for free.

  `Router` moves to the new `@implementjs/router`, written against that public API and
  nothing else. `@implementjs/core/router` is gone; navigation stays in core (`location`,
  `navigateTo`, `searchParam`, the navigation guards and the resolver).

  kit generates `import { Router } from "@implementjs/router"` and takes it as a dependency,
  and scaffolded kit apps list it too — generated code resolves from the app, not from kit.

- Updated dependencies [[`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed), [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66)]:
  - @implementjs/kit@0.0.1
