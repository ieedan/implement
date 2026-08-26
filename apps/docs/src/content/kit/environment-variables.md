---
title: Environment Variables
description: Typed environment variables that cannot leak — validated by schema, baked in at build time or read by the running server.
section: Guides
order: 17
---

Environment variables are where secrets get spilled. A build tool that inlines the wrong string into a JavaScript bundle publishes it permanently, and a prerendered site has no server to patch afterwards. Kit's answer is a set of files, distinguished by name and enforced by the compiler:

- `src/lib/env.public.ts` — safe to ship. Inlined into the browser bundle.
- `src/lib/env.server.ts` — never ships. The client copy contains no values at all.
- `src/lib/env.dynamic.server.ts` — never ships, and never baked in either: [read by the running server](#values-the-running-server-reads).
- `src/lib/env.dynamic.public.ts` — ships, and is not baked in: [carried by the page](#public-values-the-running-server-reads).

All four are ordinary TypeScript modules you write, so `typeof env` flows straight through to every file that imports one. Nothing is code-generated.

Start with the first two. The dynamic pair exists for values that have to change without a rebuild, and an app that never creates those files carries none of the machinery that serves them.

## Declaring variables

Each file calls `defineEnv` with a schema per variable and exports the result:

```ts
// src/lib/env.public.ts
import { defineEnv } from "@implementjs/kit";
import * as v from "valibot";

export const env = defineEnv({
	PUBLIC_DOCS_URL: v.pipe(v.string(), v.url()),
});
```

```ts
// src/lib/env.server.ts
import { defineEnv } from "@implementjs/kit";
import * as v from "valibot";

export const env = defineEnv({
	DATABASE_URL: v.string(),
	STRIPE_KEY: v.pipe(v.string(), v.startsWith("sk_")),
});
```

The schemas are [Standard Schema](https://standardschema.dev) — [valibot](https://valibot.dev) here and everywhere else in these docs, but arktype, zod or anything else implementing the spec works the same. Kit never imports the library itself, so the choice is yours and it costs the bundle nothing.

Then import them where you need them:

```ts
// src/routes/blog/page.server.ts
import { env } from "@/lib/env.server";
import { env as publicEnv } from "@/lib/env.public";

export default async function load() {
	return {
		posts: await query(env.DATABASE_URL),
		docs: publicEnv.PUBLIC_DOCS_URL,
	};
}
```

[`hooks.server.ts`](/kit/hooks) reads them the same way — one ordinary import, no special access:

```ts
// src/hooks.server.ts
import { env } from "@/lib/env.server";
import type { Handle } from "@implementjs/kit/server";

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = await verify(event.request, env.SESSION_SECRET);
	return await resolve(event);
};
```

`env.DATABASE_URL` is a `string` because that is what `v.string()` produces. Give a variable `v.pipe(v.string(), v.transform(Number), v.number())` and it arrives as a number. The editor knows, with no annotations and no `./$types` involved.

Server code takes two imports rather than one merged object. That is deliberate: a merged `env` would leave TypeScript seeing only one file's keys, and a call site that reads `env.DATABASE_URL` should be visibly different from one that reads `env.PUBLIC_DOCS_URL`.

## The PUBLIC_ prefix

Every key in `env.public.ts` **must** start with `PUBLIC_`, and no key in either server file may. This is fixed and not configurable.

The rule exists because the type system was never going to catch the mistake that actually happens — pasting `DATABASE_URL` into the public file. A prefix is something you can see at every call site:

```ts
// src/lib/env.public.ts
export const env = defineEnv({
	DATABASE_URL: v.string(), // ✗ build error: must start with PUBLIC_
});
```

The error names the key and points at the other file.

## Where the values come from

Kit reads the raw values with Vite's own `.env` resolution and no prefix filter, so the whole file is visible — not just `VITE_`-prefixed keys:

```
.env
.env.local
.env.[mode]
.env.[mode].local
```

Later files win, and anything already set in the real environment wins over all of them — which is how CI and hosting providers inject values.

```sh
# .env
PUBLIC_DOCS_URL=https://implement.dev
DATABASE_URL=postgres://localhost:5432/app
```

Commit a `.env.example` listing the keys with blank values; keep `.env` out of git. The scaffolded app sets both up for you.

> [!NOTE]
> Don't read `process.env` from an env file expecting `.env` to work. Vite's `loadEnv` deliberately does not populate `process.env`, which is exactly why kit sources the values itself and hands them to `defineEnv`.

## What actually gets built

Kit evaluates both of these files in Node during the build, validates them, and re-emits each one as a module of literals. The schemas — and the schema library — never enter a bundle:

| File                    | Server (dev requests, prerender)                                        | Browser bundle                 |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| `env.public.ts`         | literals                                                                | literals                       |
| `env.server.ts`         | literals                                                                | **a throwing body, no values** |
| `env.dynamic.server.ts` | left alone — [read at runtime](#values-the-running-server-reads)        | **a throwing body, no values** |
| `env.dynamic.public.ts` | left alone — [read at runtime](#public-values-the-running-server-reads) | a reader, no schemas           |

Every export of the two inlined files is inlined, not just the `defineEnv` call, which means **every export must be JSON-serializable**. A helper function in `env.public.ts` fails the build by name rather than silently vanishing:

```
src/lib/env.public.ts is evaluated at build time and its exports are inlined;
"formatUrl" is a function and cannot be inlined — move it to another module.
```

The browser copy of `env.server.ts` is the part worth internalising: it does not contain the secret in disabled form, or behind a check. It contains no values at all. Even a total failure of every other safeguard leaks nothing.

## Importing a server file from the browser

`env.server.ts` is a [server file](/kit/loading-data) under the same rule that governs `db.server.ts` — anything named `*.server.ts` is server-only, as is a route's [`server.ts` endpoint](/kit/server-routes). Kit enforces that in two layers.

**It fails the build, with the chain.** A client module importing a server file is an error in dev and on build, and because `$implement/router` imports every page eagerly, one bad import poisons the whole bundle. So the error shows how it got there:

```
src/lib/env.server.ts is a server file and cannot be imported by client code.

  src/lib/env.server.ts
  imported by src/routes/blog/page.ts as "@/lib/env.server"
    ← $implement/router
    ← .implement/entry-client.ts
```

**And the module itself throws.** If anything slips past the static check — a computed dynamic import, a re-export chain — the empty client copy throws the moment it is evaluated. That matters more here than it might elsewhere: kit server-renders every page in dev, so a page importing `env.server.ts` renders perfectly on the server and the mistake would otherwise be invisible until the secret was already sitting in a prerendered HTML file.

### Types are fine

Importing a _type_ from a server file is legal and common — type imports are erased before the module graph ever sees them:

```ts
import type { PackageInfo } from "../../routes/packages/page.server";
```

Write `import type`, not an inline `type` specifier. Under `verbatimModuleSyntax` (which scaffolded apps enable) this form leaves a real import behind and trips the guard:

```ts
import { type PackageInfo } from "./page.server"; // ✗ trips the guard
import type { PackageInfo } from "./page.server"; // ✓
```

Vite's resource queries are left alone too. `import source from "./x.server.ts?raw"` asks for the file's _text_, not its bindings — a deliberate act, and how this site renders the source of every lesson. It ships the file's source, so don't reach for it on a file whose source contains anything secret.

## Validation and failing builds

Validation runs when a file is first transformed, and a missing or malformed variable **fails the build**. There is no opt-out. Every failing key is reported at once:

```
src/lib/env.server.ts: 2 variables failed validation.

  DATABASE_URL — not set
  STRIPE_KEY — Invalid input: must start with "sk_"

Set them in a .env file or in the environment.
```

Two things keep this from being annoying:

- **It is lazy at module granularity.** An app that never imports `env.server.ts` never transforms it and never validates it.
- **`sync()` is env-unaware.** A CI job running `pnpm check` or `tsc --noEmit` needs no `.env` at all, because generating types never touches these files.

What is left is a `vite build` for an app whose loads read `DATABASE_URL`. That build genuinely cannot produce correct output without it, so failing is the honest result.

## Scope: `env.server.ts` holds build-time values

`env.public.ts` and `env.server.ts` are evaluated **once, during `vite build`**, and re-emitted as literals. A variable declared in either is read at build time and baked into whatever the build produces — the prerendered pages with no adapter, the server bundle with one.

That is a real simplification, and the right default: the schemas cost the bundle nothing, a missing variable fails the build rather than the deploy, and a value is visible in the artifact you are about to ship rather than in an environment you have to reconstruct.

It is also the thing to know before you deploy a server. With an [adapter](/kit/adapters), `DATABASE_URL` is compiled into the server bundle — so rotating it means rebuilding, and the built artifact holds the secret. When that is the wrong trade, declare the variable in the third file instead.

## Values the running server reads

`src/lib/env.dynamic.server.ts` declares variables kit does **not** bake in. Same schemas, same types, read while the app runs:

```ts
// src/lib/env.dynamic.server.ts
import { defineDynamicEnv } from "@implementjs/kit/env";
import * as v from "valibot";

export const env = defineDynamicEnv({
	BETTER_AUTH_SECRET: v.string(),
	SESSION_TTL: v.pipe(v.string(), v.transform(Number), v.number()),
});
```

Import it exactly like the other two, and `SESSION_TTL` still arrives as a `number`:

```ts
// src/routes/api/session/server.ts
import { env } from "@/lib/env.dynamic.server";

export async function POST(): Promise<Response> {
	const token = await sign(payload, env.BETTER_AUTH_SECRET, { ttl: env.SESSION_TTL });
	// ...
}
```

What you get back is a live view rather than a snapshot. The first read validates every key at once and caches the result; the cache is dropped when the environment underneath is replaced. So rotating `BETTER_AUTH_SECRET` is a restart rather than a rebuild, and the deployed artifact never held the value in the first place.

> [!NOTE]
> The import is `@implementjs/kit/env`, not `@implementjs/kit`. The other two files are replaced wholesale, so their import of kit disappears before anything is bundled — this one survives into the server bundle, and `@implementjs/kit` is a Vite plugin with esbuild attached to it. The subpath carries the two `define*` functions and nothing else.

### What it costs

Being read at runtime is not free, and the three differences are worth knowing before you move a variable across:

|                              | `env.server.ts`    | `env.dynamic.server.ts`               |
| ---------------------------- | ------------------ | ------------------------------------- |
| Rotating a value             | rebuild            | restart                               |
| A missing variable           | fails `vite build` | throws on the first read              |
| Schemas in the server bundle | no                 | yes, and the schema library with them |

None of that changes what reaches the browser. `env.dynamic.server.ts` is a `*.server.ts` file under [the same rule as every other one](#importing-a-server-file-from-the-browser): a client import fails the build with the chain, and the client copy is the same throwing stub holding no values. That is also why the name is not free-form — point `env.dynamic` somewhere that is not `*.server.ts` and kit refuses to start, because for this file the name is the only thing keeping it out of a bundle.

The `PUBLIC_` rule holds too, and a violation is caught the moment the module evaluates rather than on the first read — it needs no values to spot. Values that do ship to the browser go in [`env.dynamic.public.ts`](#public-values-the-running-server-reads) instead, which is a separate file precisely because it costs more.

### Where the values come from at runtime

| Where                    | Source                                         |
| ------------------------ | ---------------------------------------------- |
| `vite dev`, prerendering | the same `.env` resolution as the other two    |
| Node, Vercel             | `process.env`                                  |
| Cloudflare               | the worker's bindings, wired up by the adapter |

Node and Vercel need nothing: `process.env` is the fallback. A worker has no `process.env` at all — its vars and secrets arrive with the request — so [`@implementjs/adapter-cloudflare`](/kit/adapters) hands them over in its own entry, and a hand-rolled host does the same:

```js
import { setDynamicEnv } from "@implementjs/kit/env";

export default {
	fetch(request, env, context) {
		setDynamicEnv(env);
		return handler(request, { platform: { env, context } });
	},
};
```

One assignment per request, and kit re-validates only when the object changes. The catch on a worker is that the environment does not exist until the first request, so a module that reads `env.DATABASE_URL` at the _top level_ — building a connection pool as it loads, say — has nothing to read. Reach for these values inside a load, an endpoint or a hook.

### Prerendering reads the build's environment

A prerender has no runtime, so it is given the build's `.env` values like everything else. A page that prerenders a dynamic value therefore bakes it in, which is the one case where this file behaves exactly like the one it was meant to replace. Keep dynamic values on routes that [render per request](/kit/ssr-and-prerendering).

## Public values the running server reads

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

Import it from anywhere — a page, a component, a load — and read it like any other env file:

```ts
// src/routes/upload/page.ts
import { env } from "@/lib/env.dynamic.public";

export default function Page(): Child {
	return P(`Up to ${env.PUBLIC_UPLOAD_LIMIT} MB`);
}
```

### Only the server runs the schemas

This is the difference between kit's version and the equivalent elsewhere. The `defineDynamicPublicEnv` call never runs in a browser. Kit replaces the module in the client graph with a reader over the values the page is carrying — already validated, already coerced, so `PUBLIC_UPLOAD_LIMIT` arrives as a `number` — and neither the schemas nor the schema library are in the client bundle. That is the promise `env.public.ts` makes, kept for a value that is not known until a request.

The values ride along in the document kit renders, next to the route data:

```html
<script type="application/json" data-implement-env>
	{ "env": { "PUBLIC_API_URL": "…" } }
</script>
```

### Prerendered pages fetch them

A prerendered page was written before there was a request, so it carries no current values. What happens next depends on whether the app ships a server:

| The app                                     | A prerendered page                                         |
| ------------------------------------------- | ---------------------------------------------------------- |
| has an [adapter](/kit/adapters) that serves | boots from `/_implement/env.js`, so it sees current values |
| is static, or its adapter serves nothing    | keeps the build's values, exactly as `env.public.ts` would |

The boot module goes first in the document's `<head>`. Module scripts run in document order, so it is assigned before the app's entry — and before any module that reads it — evaluates:

```html
<head>
	<script type="module" src="/_implement/env.js"></script>
	…
</head>
```

That is a round trip in front of hydration, on every prerendered page, for the whole app. It is the price of a public value that is not baked in, and it is why this is a separate file rather than a flag on another one: create it and you have opted in, leave it out and the route is never mounted, the import is never generated, and nothing is embedded in any page.

> [!NOTE]
> `/_implement/env.js` is served by kit's own pipeline, before hooks and before route matching. It is revalidated rather than cached outright, and its body is built once per process — rotating a value is a restart, which is the whole bargain of a dynamic variable.

## Running outside kit

`defineEnv` is not magic, and the transform is a secret-scrubber and an optimisation rather than the only code path. Run one of these files under plain `node` or `vitest` and it validates against `process.env` instead, returning the same shape. The files stay honest, and they stay unit-testable.

`defineDynamicEnv` and `defineDynamicPublicEnv` read `process.env` there too — it is the fallback everywhere, and outside kit there is nothing else to point them at. Give a test its own values with `setDynamicEnv({ ... })` from the same import.

## Options

All three paths are configurable, relative to your Vite root:

```ts
kit({
	env: {
		public: "src/lib/env.public.ts",
		server: "src/lib/env.server.ts",
		dynamic: "src/lib/env.dynamic.server.ts",
		dynamicPublic: "src/lib/env.dynamic.public.ts",
	},
});
```

A file that doesn't exist simply turns that part off — an app with none of them behaves exactly as it did before. `dynamic` must still be named `*.server.ts`, and `dynamicPublic` must not be.

## Where to next

- [Loading Data](/kit/loading-data) covers the server files that read these values.
- [Server Hooks](/kit/hooks) covers `hooks.server.ts`, the other server file that reads them.
- [SSR & Prerendering](/kit/ssr-and-prerendering) covers when the build actually runs them.
