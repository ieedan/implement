# @implementjs/kit

## 0.0.10

### Patch Changes

- Updated dependencies [[`0ac0208`](https://github.com/ieedan/implement/commit/0ac0208d825804969a58c61fb21063724a10e431)]:
  - @implementjs/core@0.0.8
  - @implementjs/router@0.0.9

## 0.0.9

### Patch Changes

- Updated dependencies [[`5077090`](https://github.com/ieedan/implement/commit/50770900102e0dafbccbf187054ed2cdfcdcefa5)]:
  - @implementjs/core@0.0.7
  - @implementjs/router@0.0.8

## 0.0.8

### Patch Changes

- [#62](https://github.com/ieedan/implement/pull/62) [`2702c55`](https://github.com/ieedan/implement/commit/2702c55c546c2a82a3517ff997aad4628e203b70) Thanks [@ieedan](https://github.com/ieedan)! - Fix an app with a param matcher losing every type it gets from `@implementjs/router` — `router.Link` included. The `ParamTypes` block filling in the matchers' types was written into `$implement.d.ts`, which is a script (no top-level `import` or `export`), and there a `declare module "@implementjs/router"` is an _ambient module declaration_ that takes the package's name over rather than augmenting it. Nothing errored: the package's own exports simply stopped existing, so `RouterHelper` resolved to nothing, `router` collapsed to `any`, and `to`, `params`, `Router`, and `RouterError` went unchecked along with it. The augmentation now goes to `.implement/types/$implement-params.d.ts`, a module, and is removed again when the last matcher does — `$implement.d.ts` stays a script, which its own `declare module "$implement/*"` blocks and `declare namespace App` require.

- [#62](https://github.com/ieedan/implement/pull/62) [`05d9b20`](https://github.com/ieedan/implement/commit/05d9b20ead7c52f3eba9fdbaff03363a7b81f8b3) Thanks [@ieedan](https://github.com/ieedan)! - Pre-bundle the deps that only kit's generated modules import, so dev stops answering with `504 (Outdated Optimize Dep)`. Vite's dep scanner externalizes virtual modules, so its startup crawl stopped at `$implement/router` and never saw what hangs off it — the route modules, the param matchers, or `@implementjs/router` and `@implementjs/kit/params` themselves. The browser discovered them instead on first load, which re-bundles, moves every optimized URL's `?v=` hash, and kills the requests already in flight. The plugin now points the scan at the real files behind those virtual modules (`page.ts`, `layout.ts`, their `@` reset variants, `error.ts`, and `src/params/*.ts`) and names kit's own imports in `optimizeDeps.include`, so an app no longer has to declare them in its own `vite.config.ts`. Server files stay out of it: a dep only a `*.server.ts` imports is still no business of the browser's pre-bundle.

## 0.0.7

### Patch Changes

- [#59](https://github.com/ieedan/implement/pull/59) [`e9bf3b1`](https://github.com/ieedan/implement/commit/e9bf3b1e2919f8518248ad3804f310f8a15a2878) Thanks [@ieedan](https://github.com/ieedan)! - Warn about files in the routes tree whose names only just miss a routing one. `+server.ts`, `page.tsx`, and `+page.server.js` are colocated code as far as the scan is concerned, so the route they were meant to be simply never existed and nothing said why. The dev server and the build now print `unknown file "src/routes/api/+server.ts" — did you mean "server.ts"?`, and the dev server says it the moment such a file is written. Genuinely colocated code (`Button.ts`, `layout.css`, `page.test.ts`) stays silent.

- [#57](https://github.com/ieedan/implement/pull/57) [`b51e829`](https://github.com/ieedan/implement/commit/b51e8295af17c8d72287b71e6e312c50bcc12c4f) Thanks [@ieedan](https://github.com/ieedan)! - Use valibot as the schema library everywhere the docs and templates need one

  Kit still takes any [Standard Schema](https://standardschema.dev) — arktype and zod included,
  each still converted to JSON Schema through its own package — but every example, doc and
  scaffolded file is now written in valibot, which is what `@implementjs/formish` already
  required. A scaffolded kit app ships `valibot` as a devDependency in place of `zod`.

  Kit's valibot-to-JSON-Schema conversion now runs with `errorMode: "ignore"`, so a schema
  carrying a transform is documented as unconstrained instead of dropping the route's
  parameters and warning. That matches what the zod converter already did with
  `unrepresentable: "any"`.

- Updated dependencies [[`00239de`](https://github.com/ieedan/implement/commit/00239de0e84fe27b2f8737e977d973b4d24c454e)]:
  - @implementjs/core@0.0.6
  - @implementjs/router@0.0.7

## 0.0.6

### Patch Changes

- Updated dependencies [[`f60114f`](https://github.com/ieedan/implement/commit/f60114f329cd73c5922a60c8337566afa97d3f21)]:
  - @implementjs/core@0.0.5
  - @implementjs/router@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [[`14ce276`](https://github.com/ieedan/implement/commit/14ce276cf1a03340930ae030410551d23efa724e)]:
  - @implementjs/core@0.0.4
  - @implementjs/router@0.0.5

## 0.0.4

### Patch Changes

- [`c4cdbfd`](https://github.com/ieedan/implement/commit/c4cdbfd9590eda1e8df1ae1c3c241c98cd6b8b15) Thanks [@ieedan](https://github.com/ieedan)! - Treat a route's `server.ts` as server-only, and name the import that dragged a server file in.

  An endpoint is not spelled `*.server.ts`, so the guard did not recognise one: a
  client file importing a value from `src/routes/api/issues/server.ts` — a
  validation schema shared with a form, usually — pulled the whole endpoint into
  the client graph, handlers and database and all. It only ever surfaced one hop
  later, if the endpoint happened to import a `*.server.ts`, and never at all if it
  did not. Both layers now know an endpoint for what it is: the import errors at
  the boundary, and the client copy of a `server.ts` is the same empty throwing
  stub every server file gets.

  The importer chain in that error now names the import each link wrote, so the one
  to delete reads straight off the message instead of being bisected by hand:

  ```
  src/lib/db.server.ts is a server file and cannot be imported by client code.

    src/lib/db.server.ts
    imported by src/routes/api/issues/server.ts as "@/lib/db.server"
      ← src/lib/features/issues/create-issue-dialog.ts:7 imports { NewIssueSchema }
      ← src/routes/(dashboard)/layout.ts:3 imports { CreateIssueDialog }
      ← $implement/router
  ```

- [#39](https://github.com/ieedan/implement/pull/39) [`3752116`](https://github.com/ieedan/implement/commit/3752116f9afa8da206ea2c40bd27db7b0935cba1) Thanks [@ieedan](https://github.com/ieedan)! - Replace the client's `"path"` style with a `"nested"` one, and fail loudly when the `neverthrow` style is picked without the package.

  `api.client.style` now picks between `"method"` (the default) and `"nested"`. `"path"` is gone: `api["/api/posts/[id]"].GET(…)` only ever swapped where the route key was typed, so in its place `"nested"` builds the client as a tree of the app's own routes:

  ```ts
  // vite.config.ts
  kit({ api: { client: { style: "nested" } } });
  ```

  ```ts
  const { data, error } = await api.api.posts["[id]"].GET({ params: { id: "1" } });
  await api.docs["[...slug].md"].GET({ params: { slug: "guide/install" } });
  ```

  Every level offers only the segments that continue a route, with the methods at the leaf, so a call is reached by autocomplete rather than by typing a whole route key. It composes with all three error styles — `NestedClient` and `ResultNestedClient` replace `PathClient` and `ResultPathClient` — and the seven HTTP method names become reserved segments.

  The generated `createClient` now also passes the style and error handling the app configured. It annotated its return type with them but called `create(options)` without them, so an app that had picked `"throw"` or the old `"path"` style got a client that was typed one way and dispatched another.

  `errors: "neverthrow"` without `neverthrow` installed used to generate a client whose types silently resolved to nothing — `neverthrow` is an optional peer, and the only sign was `tsc` failing to find a module inside a generated file. Codegen now stops with a message naming the option and what to do about it, and `implement-kit sync` prints that message once rather than repeating it inside the stack it prints after.

- [#39](https://github.com/ieedan/implement/pull/39) [`4c3c44e`](https://github.com/ieedan/implement/commit/4c3c44ea5ce6ac7a084a7c15a3330dd3f287f692) Thanks [@ieedan](https://github.com/ieedan)! - Fix two holes in the generated client's types: `event.api` had no methods at all, and returning JSON with a custom status typed `data` as `never`.

  **`event.api` was an empty `App.Api`.** The generated declaration wrote `interface Api extends import("@implementjs/kit/client").TypedClient<…> {}`, and an interface may only extend a _name_ — extending an inline `import(…)` type is `TS2499`. Apps compile their generated types with `skipLibCheck`, so nobody ever saw the error: `App.Api` merged as empty, `keyof` was `never`, and `api.GET(…)` in a load was `Property 'GET' does not exist`. The client is now named before it is extended, so `event.api` in loads, handlers, and hooks is the same client `$implement/client` exports — same style, same routes, same `data`.

  A server assembled without `createApiClient` used to get `{}` for `event.api`, which only typechecked while `App.Api` was empty. It now gets a stand-in whose every method throws a message naming the missing option, instead of failing as `undefined is not a function`.

  **`json()` sets a status without losing the body's type.** Returning a `Response` opts out of response handling, so `data` was `Exclude<Awaited<R>, Response>` — and `Response.json(issue, { status: 201 })` is a `Response`, which made `data` `never`. `json` is `Response.json` with the body type kept:

  ```ts
  import { handler, json } from "./$types";

  export const POST = handler({
  	body: NewIssue,
  	handle: async ({ body }) => json(await createIssue(body), { status: 201 }),
  });

  const { data } = await api.POST("/api/issues", { body }); // the issue, not `never`
  ```

  It comes from `@implementjs/kit/server` and a route's `./$types` re-exports it beside `handler`. A plain `Response` is still the escape hatch for a body that is not JSON, and still reads as `never` — there is nothing to say about it. With a `response` schema the schema types `data`, and returning any `Response` still skips that validation.

- Updated dependencies [[`c4cdbfd`](https://github.com/ieedan/implement/commit/c4cdbfd9590eda1e8df1ae1c3c241c98cd6b8b15)]:
  - @implementjs/core@0.0.3
  - @implementjs/router@0.0.4

## 0.0.3

### Patch Changes

- [#40](https://github.com/ieedan/implement/pull/40) [`96c8eb9`](https://github.com/ieedan/implement/commit/96c8eb97aa3a1c5fe234f1c5ab068411476f5cdb) Thanks [@ieedan](https://github.com/ieedan)! - Route param matchers, with the type they produce. A `src/params/<name>.ts`
  default-exports a `matcher()`, and a `[id=<name>]` route directory names it: a
  segment the matcher turns down is not a match, so the path falls through to the
  next route and reaches the error page rather than a handler that has to check
  for itself.

  A matcher may also _parse_ the segment, and what it returns is what the param is
  everywhere downstream — `event.params` in a load or a `server.ts` handler,
  `params` in a page or layout, the generated client. The generated `./$types`
  read the type off the matcher module, so it is declared once:

  ```ts
  // src/params/integer.ts
  import { matcher, mismatch } from "@implementjs/kit/params";

  export default matcher((value) => {
  	const parsed = Number(value);
  	return /^\d+$/.test(value) ? parsed : mismatch;
  });
  ```

  ```ts
  // src/routes/posts/[id=integer]/server.ts
  export const GET = handler({ handle: ({ params }) => db.post(params.id) });
  //                                                          ^? number
  ```

  `matcher()` takes a pattern (anchored to the whole segment), a parse function, or
  a Standard Schema. Matchers live in `src/params` by default — `kit({ params })`
  moves them.

- Updated dependencies [[`96c8eb9`](https://github.com/ieedan/implement/commit/96c8eb97aa3a1c5fe234f1c5ab068411476f5cdb)]:
  - @implementjs/router@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [[`aee1296`](https://github.com/ieedan/implement/commit/aee129639e5d4f04d3285c017c42fa3649fab48b)]:
  - @implementjs/core@0.0.2
  - @implementjs/router@0.0.2

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

- Updated dependencies [[`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed), [`6629993`](https://github.com/ieedan/implement/commit/662999342363fb2bbdf37966bb0530c1d084f375), [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66)]:
  - @implementjs/core@0.0.1
  - @implementjs/vite@0.0.1
  - @implementjs/router@0.0.1
