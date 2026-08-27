# @implementjs/kit

## 0.0.18

### Patch Changes

- [#92](https://github.com/ieedan/implement/pull/92) [`a16600b`](https://github.com/ieedan/implement/commit/a16600b3170dc5d5df2638a92adee86f80506ee0) Thanks [@ieedan](https://github.com/ieedan)! - Bundle the JSON-Schema converters an app has installed, so an MCP route serves real tool schemas in production

  `tools/list` converts each tool's `input` through the vendor's own converter package (`zod`, `@valibot/to-json-schema`), reached by a dynamic import whose specifier was a variable. The bundler never saw it, so the converter was left out of the server bundle — and an adapter that ships a self-contained bundle has no `node_modules` for the bare specifier to resolve against, so every conversion failed. Each failure was swallowed into a `console.warn` and an unconstrained `{"type":"object"}`: the model saw every tool's name and description and not one of its arguments. Dev and `vite preview` resolved the package from disk, so it only happened once deployed.

  Kit's Vite plugin now emits `$implement/schema-converters`, a static import of each converter package the app actually has, and the conversion reads from that — so what the build sees is what ships. The same path backs `tool.fromEndpoint` and the live `api.openapi.path` route.

  A converter that cannot be reached, or that throws on a schema, now fails `tools/list` with the tool's name and the reason instead of listing the tool with no arguments. A vendor kit has no converter for still degrades to an unconstrained schema with a warning — nothing kit can do about that one — and `inputJsonSchema` is documented as the way to publish a schema yourself.

## 0.0.17

### Patch Changes

- [#88](https://github.com/ieedan/implement/pull/88) [`598c071`](https://github.com/ieedan/implement/commit/598c071b3ce17de9aaaaab69ba443a6157197ea3) Thanks [@ieedan](https://github.com/ieedan)! - Say `LayoutLoadEvent` when a `layout.server.ts` is still typed with `LoadEvent`.

  A route's `$types` used to export one load event, and it was right everywhere.
  It exports two now — so a page load can see its parent's data — and `LoadEvent`
  is the page's: it carries what every load above the page returned, this
  directory's own layout load included. A `layout.server.ts` annotated with it is
  inside its own type, which `tsc` reports as

  ```
  src/routes/app/layout.server.ts(13,36): error TS2502: '{ locals }' is referenced directly or indirectly in its own type annotation.
  ```

  pointed at the destructured parameter, naming neither `LoadEvent` nor the
  `LayoutLoadEvent` that fixes it. A load written before the split kept compiling
  right up to the upgrade, and then failed with the one message that says nothing
  about why.

  The dev server, the build, and `implement-kit sync` now warn when a
  `layout.server.ts` imports `LoadEvent` from its `$types`, naming the file and
  the type it wants. The scan already knew the file was there; now it reads what
  it asked for.

  Both load events carry a doc comment in the generated `$types` as well, so which
  file takes which is answerable from the hover rather than from the names, which
  differ by one word.

## 0.0.16

### Patch Changes

- [#87](https://github.com/ieedan/implement/pull/87) [`c3136ff`](https://github.com/ieedan/implement/commit/c3136ff24c5cdbda4aad32fc5662f909aeed8887) Thanks [@ieedan](https://github.com/ieedan)! - `@implementjs/kit/mcp`: a tool can answer with image and audio content, not only text. `tool.image(data, mimeType)` and `tool.audio(data, mimeType)` build the blocks the protocol has for bytes — base64 as a string, or `Uint8Array`/`ArrayBuffer` kit encodes — so a tool handing back a screenshot gives the model a picture to look at instead of characters it cannot read. `tool.content(...blocks)` answers with as many blocks as the answer needs, `tool.structured(value, ...blocks)` carries `structuredContent` alongside them, and the exported `ToolResult` widens from text-only to the three block types the spec defines.

- [`589641f`](https://github.com/ieedan/implement/commit/589641fc1e8bbea1b732e12db8953cb9868bb5b5) Thanks [@ieedan](https://github.com/ieedan)! - `mcp()` reads an argument the model sent as JSON text.

  A tool call is generated as text, and nesting does not always survive that: a
  model asked for `changes: { status: "in_progress" }` routinely sends
  `changes: "{\"status\":\"in_progress\"}"` instead. The client cannot repair it —
  it has no schema — so every such call came back as `invalid input — changes:
Invalid type: Expected Object but received "{…}"`, and the model had no spelling
  left to try.

  `tools/call` now coerces against the tool's own JSON Schema before validating,
  and only where the schema leaves no room for doubt: a value is re-read as JSON
  when the schema cannot accept a string in that position and the parse lands on a
  kind it can accept. A `v.string()` field holding `"{"` stays that string, a
  `v.union([v.string(), v.object(…)])` keeps the caller's spelling, and text that
  parses to the wrong kind is left alone so the schema rejects it with its own
  message. The walk follows `$ref` into `$defs`, reaches values nested inside a
  structure that arrived correctly, and covers `tool.fromEndpoint()`'s
  `params`/`query`/`body` envelope — including the envelope itself, which a model
  sometimes stringifies whole and which used to be dropped silently.

- Updated dependencies [[`19a54ae`](https://github.com/ieedan/implement/commit/19a54ae2508e2d65e9f5505685a7d3d1f1738895)]:
  - @implementjs/core@0.0.11
  - @implementjs/router@0.0.13

## 0.0.15

### Patch Changes

- Updated dependencies [[`dee038d`](https://github.com/ieedan/implement/commit/dee038d6cfab50e818a237e002f1d97a1e9a93d3)]:
  - @implementjs/core@0.0.10
  - @implementjs/router@0.0.12

## 0.0.14

### Patch Changes

- [#83](https://github.com/ieedan/implement/pull/83) [`a966956`](https://github.com/ieedan/implement/commit/a966956b4ea83998980e725adde89d78ee98d6a4) Thanks [@ieedan](https://github.com/ieedan)! - Add `@implementjs/kit/mcp`: an MCP server as a route. `mcp()` turns a set of tools into the `POST`/`GET`/`DELETE` handlers a `server.ts` re-exports, `tool()` declares one tool from a Standard Schema and a function, and `tool.fromEndpoint()` exposes an existing validated endpoint as a tool under its own schemas. The protocol — JSON-RPC framing, `initialize` and version negotiation, the Origin check, the RFC 9728 `WWW-Authenticate` challenge that starts OAuth — is handled once, and `tools/list` converts input schemas through the same vendor detection the OpenAPI document uses.

- [#82](https://github.com/ieedan/implement/pull/82) [`b2c045b`](https://github.com/ieedan/implement/commit/b2c045be858f13f1a059fd9316f3e915445fb10e) Thanks [@ieedan](https://github.com/ieedan)! - `sse()`, for a `server.ts` endpoint that answers now and keeps writing.

  A handler's `Response` already reached the client untouched — kit never
  buffered one, and neither did the `hooks.server.ts` around it — so a
  `ReadableStream` body has always worked. Nothing said so, nothing said how long
  each host would hold one, and the generated client read a raw `Response` as
  `data: never` while its runtime called `.text()` on the body, which is exactly
  what a stream with no end never comes back from. So the one shape people
  actually wanted was the one shape that could not be consumed.

  `sse` builds the response, and the client knows how to read it:

  ```ts
  // src/routes/api/inbox/stream/server.ts
  import { handler, sse } from "./$types";

  export const GET = handler({
  	handle: ({ locals }) =>
  		sse<Notification>(async function* (signal) {
  			for await (const notification of watchInbox(locals.user.id, signal)) {
  				yield { event: "notification", data: notification };
  			}
  		}),
  });
  ```

  ```ts
  const { data, error } = await api.GET("/api/inbox/stream");
  if (error !== undefined) return;
  for await (const { data: notification } of data) show(notification);
  ```

  Each `yield` is one frame — `data` is the payload, serialized as JSON and typed
  end to end, and `event`, `id`, and `retry` are the format's own fields. Like
  `json()`, an `sse()` is still a plain `Response` that skips response handling;
  unlike one, it says what a caller receives, so `data` is the events rather than
  `never`. The call settles when the headers arrive, and `break`ing out of the
  loop closes the connection.

  A stream ends when its source does, when the client goes away, or when a
  `signal` you passed aborts — all three return the iterator, so a generator's
  `finally` runs. The source function is handed a signal of its own for the case
  a return cannot reach: a generator parked on a promise is only interrupted at a
  `yield`, so waiting under that signal is what makes a disconnect wake it. A
  keep-alive comment goes out every 15s by default, since an idle connection is
  one a proxy eventually closes.

  Two other things came with it:

  - The docs now say which adapters can hold a long-lived response, and what ends
    one on each — Node and Cloudflare for as long as the source lives, Vercel
    until `maxDuration`, a static build not at all.
  - The prerenderer says an event stream cannot be a file, and names the endpoint,
    rather than hanging the build on a response that was never going to finish.

- [#79](https://github.com/ieedan/implement/pull/79) [`d8941a0`](https://github.com/ieedan/implement/commit/d8941a07d33300fbd9cddd63ac915d184ea5ef72) Thanks [@ieedan](https://github.com/ieedan)! - A schema inlined into the OpenAPI document no longer carries a `$schema` of
  its own.

  Every converter stamps a dialect on what it hands back — draft-07 from
  valibot, 2020-12 from zod — declaring the dialect of a document it thinks it
  is the root of. Inlined into an operation it is not, and the one kit generates
  says `"openapi": "3.1.0"`, whose dialect is 2020-12. So a valibot app shipped a
  `"$schema": "http://json-schema.org/draft-07/schema#"` beside every body,
  response, and parameter in the document, disagreeing with the document that
  contains it — something a strict validator is entitled to complain about.

  It now comes off wherever the schema came from: kit's own per-vendor
  converters, the built-in matchers behind a `[id=integer]` param, and an app's
  own `api.openapi.toJsonSchema`. Only the key is dropped; nothing else about
  the converted schema changes.

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

- Updated dependencies [[`e9e3451`](https://github.com/ieedan/implement/commit/e9e3451627bf62f9407b3793b0a598d7738a4b2a)]:
  - @implementjs/vite@0.0.3

## 0.0.13

### Patch Changes

- [#75](https://github.com/ieedan/implement/pull/75) [`ad05ed6`](https://github.com/ieedan/implement/commit/ad05ed61f02f76235fd696d7227eab15e3443ea6) Thanks [@ieedan](https://github.com/ieedan)! - `[id=integer]` and `[price=number]` work with nothing in `src/params`. Every app that wanted a numeric param had to write the same matcher file first, and once a matcher had to be a schema that was a few more lines than it was worth for the two cases everybody reaches for. They are ordinary matchers, so a route naming one is not special in any way — the param is a `number` in the page, the load, the handler, the generated client and the OpenAPI document, and both read a segment the way `Number` does rather than policing how it is written. What they turn down is what `Number` invents rather than refuses: `NaN` for a segment that is not a number, `Infinity` for one too large to hold, and a fraction where a whole number was asked for.

  A `src/params/integer.ts` of your own still wins, so these are defaults rather than reserved words — the app's matchers are spread over the built-ins wherever the two meet, in the runtime table, in `./$types`, and in the router's `ParamTypes`. Kit cannot depend on a schema library, so the built-ins implement Standard Schema directly, which is also what an app does when it would rather not add one; they carry their own JSON Schema, since a converter is per-vendor and kit's own schemas have no vendor package to convert them.

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

- [#75](https://github.com/ieedan/implement/pull/75) [`b0a4d26`](https://github.com/ieedan/implement/commit/b0a4d264717f2c86b638fe8341b78ffebd93d1eb) Thanks [@ieedan](https://github.com/ieedan)! - Loads can be re-run on demand, and can read what the loads above them returned.

  `invalidate()` and `invalidateAll()`, from the new `$implement/navigation` module, re-run the loads feeding the page on screen and reseed `data` with what they return. Until now a load was write-once per navigation: the blessed, end-to-end-typed way to get data into a page had no way to say "that is stale now", so every mutation grew a workaround around it — a signal seeded from `data` and patched by hand, a module-scope signal to reach a component on another branch of the tree, a poll for a count that only changes when the user does something. Invalidation goes through the same `__data.json` endpoint a client navigation already uses, so it is the same `runLoads`, the same merge, and the same typed `data`; the result lands in the store the mounted page is reading, so a component holding `data` — or anything derived from it — sees the new value where it stands, with nothing remounted and nothing patched. `invalidate("/app/:slug")` narrows it to a route that is part of what is rendered, which is how a page re-runs the load behind the shell around it. An answer overtaken by a newer invalidation, or by a navigation onto another route, is dropped rather than seeded over what replaced it.

  `LoadEvent` gains `parent()`: what the loads above this one returned, merged root first — the same merge `data` is, minus this load's own contribution, and typed from those loads' return types through the route's `./$types`. A layout and the pages beneath it run for one request and kit already merges their results for the component, but they could share nothing on the way there, so a membership check that belongs in the layout was re-run by every page under it: a duplicated query per request, and a duplicated authorization decision. `./$types` now exports `LoadEvent` for `page.server.ts` (whose parent is every layout above the page, that directory's own included) and `LayoutLoadEvent` for `layout.server.ts` (whose parent is the layouts above it).

  A route's loads now all **start** in one pass rather than running one after another, so a chain of independent loads costs one round of work instead of one per level. `parent()` is the opt-in back into sequencing, and it only ever waits on the loads above the one calling it — a page load awaiting its layout's data cannot deadlock, and a sibling that never calls it carries none of that wait. Two consequences worth knowing: a load can no longer rely on a load above it having mutated `locals` first (pass the value through `parent()` instead), and when more than one load in a chain fails, the request still answers with the root-most failure, as it did when the chain ran in order.

  A client navigation's data request now carries the destination's query string, so a load reading `url.searchParams` sees what the page was asked with rather than nothing — the server already rebuilt `event.url` from it, and only the browser half was dropping it.

- [#75](https://github.com/ieedan/implement/pull/75) [`cb2dffb`](https://github.com/ieedan/implement/commit/cb2dffb0053a570bf39992b81a290dcc5970596c) Thanks [@ieedan](https://github.com/ieedan)! - Keep a param matcher out of the OpenAPI path template, and document what the matcher parses the segment to. A route directory named `[number=integer]` emitted the path key `/api/items/{number=integer}` while its parameter object was named `number`, so the document was invalid for that route: a generated client or a Swagger UI looked for a parameter that was not there. The matcher gates which requests reach a route, which is the app's business and not the URL's, so it now comes off the template and out of the operation id along with it. Two routes binding one name behind different matchers reach the same template, and the document warns rather than quietly documenting one of them.

  The same parameter was documented as a `string` even where the matcher parsed it to a `number` and kit's own types said so everywhere else. **`matcher()` now takes a Standard Schema and nothing else** — the pattern and parse-function forms are gone. A parsing matcher written as a bare function typed its param `number` throughout the app while the document, written by a build with no types to read, went on calling it a string: the app right, the document wrong, and nothing to say they disagreed. A schema exists at runtime, so the one object gates the segment, types the param, and is converted into the document's parameter — through the same per-vendor path a handler's `params` schema takes — and the three cannot drift. `[id=integer]` is documented as an integer, carrying whatever else the schema constrains, and a handler's own `params` schema still wins over the matcher. Standard Schema is an interface rather than a dependency, so an app without a schema library can pass `matcher()` an object implementing it directly. Migrating: `matcher(/^\d+$/)` becomes `matcher(v.pipe(v.string(), v.regex(/^\d+$/)))`, and a parse function becomes the schema that was already implied by it — note that kit anchored a bare pattern for you and a schema's regex is the schema's own, so add the `^` and `$` yourself.

  A handler's `params` schema now **merges** with the route's params instead of replacing them. Declaring a schema for one param dropped every other param the route bound, so a four-param route had to redeclare three params it never meant to touch — and the docs' single-param example is a route where replacing and narrowing look identical. What the schema declares wins; what it says nothing about comes through as the route bound it, at runtime and in the type.

  Stop `api.openapi.path` making every build log `[vite] (ssr) Error when evaluating SSR module /src/routes/(openapi)`. The prerender policy read each endpoint's `prerender` export off its file, and the OpenAPI route is generated rather than scanned — there is no file under the routes dir to read, so every build reported a missing module that looked exactly like a broken import and pointed at a path the app never wrote. The synthetic route now takes the build's default: a static build writes the document out, a build with a server behind it serves it live.

- [#75](https://github.com/ieedan/implement/pull/75) [`1db158e`](https://github.com/ieedan/implement/commit/1db158e951f0bf07d63681a153f7e1d972905ac4) Thanks [@ieedan](https://github.com/ieedan)! - Cookies on the request event, and an `error.ts` in any route directory.

  `event.cookies` — `get`, `getAll`, `set`, `delete` — is there wherever the event is: a hook, a load, an endpoint. Until now cookies were raw headers in one direction and impossible in the other. Reading meant `event.request.headers.get("cookie")` and parsing the header yourself; writing had nowhere to go at all, since `setHeaders` is one value per header by design and a load has no access to the response. Anything doing its own sessions — or just remembering a filter, a last-visited workspace, a dismissed banner — hand-built `Set-Cookie` strings somewhere that could still reach the response, and could not do it from a load at all. `Set-Cookie` is also the one header where "one value per header" is wrong: it is legitimately repeated, so cookies are _appended_ to the response, and two cookies are two headers rather than one that no browser reads.

  A cookie set in a load goes out on the rendered document **and** on the `__data.json` a client navigation fetched, because a cookie set during a navigation that never reaches the browser is a bug nothing would ever say out loud. Values are encoded on the way out and decoded on the way back, quoted values included, so anything a string can hold survives the round trip. Kit fills in the attributes that decide where a cookie goes and leaves the lifetime to the caller: `path: "/"` (the browser's own default is the current directory, which makes a cookie set from a deep route invisible to the rest of the app), `httpOnly`, `sameSite: "lax"`, and `secure` whenever _this_ request arrived over https — a blanket `Secure` would have the browser drop every cookie set in dev over `http://localhost` and say nothing. `delete` sends the same cookie back empty with an expiry in the past, `path`/`domain` included so the browser matches the cookie it is meant to replace. Reads see this request's own writes, so a load reads back the session the hook above it just issued, and `event.fetch` forwards that same state on same-origin calls.

  An `error.ts` may now sit in any route directory, covering that directory and everything under it; kit used to refuse one anywhere but the routes root. So a 404 deep inside an app shell (`/app/acme/issue/9999`) rendered the same bare full-page error as a 404 at the root, losing the sidebar, the workspace switcher, and any way back that was not the browser's back button. The nearest boundary up the tree now wins and renders **inside the layouts around it** — the same chain the page it replaced would have rendered in — with the root `error.ts` still the fallback for everything no section answers for. Kit runs the boundary's layout load chain before rendering it, so a shell that reads `data` is a real shell rather than an empty one, and the boundary's own params come with it: `/app/:slug` still knows which workspace the 404 was in. A root error page now renders inside the root layout for the same reason, where before it replaced the document. The prerendered `404.html` is still the root one's — a section boundary cannot answer for a path a static host has never heard of.

- [`a8d5286`](https://github.com/ieedan/implement/commit/a8d528668fb5ac32d63d9e36fad3a81a632e04c5) Thanks [@ieedan](https://github.com/ieedan)! - Links the router follows preload their route's code and data before they are followed.

  A navigation already resolved the destination's chunks and its `__data.json` before committing — the click just paid for both. It now usually pays for neither: the pointer arriving over a link (or focus landing on it) starts the same two fetches a couple of hundred milliseconds early, and the navigation spends what is waiting instead of asking again.

  The default applies to `router.Link` and nothing else, which is narrower than it might look and deliberate. This framework routes a `Link` click and leaves every other `<a>` to the browser, so a plain `<a href="/somewhere">` is a full document load — a chunk or a payload warmed for one is thrown away the moment it is followed. `@implementjs/router` now marks its own anchors with `data-implement-link` (exported as `ROUTED_LINK_ATTRIBUTE`) to say the click stays in the page, and that marker is what the default follows.

  The behaviour is otherwise declared in markup rather than wired per link. Any element may carry `data-implement-preload-data` (`"hover"`, `"tap"`, `"off"`) or `data-implement-preload-code` (`"eager"`, `"viewport"`, `"hover"`, `"tap"`, `"off"`), and links beneath it take the nearest one — so a subtree whose loads are expensive enough that a passing pointer should not run one holds them back to the press without touching the links themselves. A named attribute is honoured on any link, routed or not, which is how an app that routes a link its own way opts in. `kit({ preload })` sets what a routed link inherits when nothing above it says otherwise. Only code offers `"eager"` and `"viewport"`: a chunk is immutable and cached for the life of the page, while a load result goes stale, and prefetching every one in the viewport would be a way to serve the reader yesterday's data.

  `@implementjs/kit/navigation` is a new entry exporting `preloadCode(...hrefs)` and `preloadData(href)`, for the navigations markup cannot predict — a wizard warming its next step, a row that opens on double click. A preloaded payload waits rather than being applied (seeding it would re-render the page the reader is still on), is spent by the next navigation to that route, and is dropped after 30 seconds unspent, so preloading stays a speed change rather than a caching layer.

  Nothing is preloaded speculatively while `navigator.connection.saveData` is set, and links the browser owns are left alone throughout: another origin, `target="_blank"`, `download`, `rel="external"`, `mailto:`, a bare fragment, or a link back to the page already on screen.

- Updated dependencies [[`a8d5286`](https://github.com/ieedan/implement/commit/a8d528668fb5ac32d63d9e36fad3a81a632e04c5), [`acc73c7`](https://github.com/ieedan/implement/commit/acc73c732c927585a7064f4805cd08a1f625f6fc), [`88c4745`](https://github.com/ieedan/implement/commit/88c4745c2e9bdc1819abe112200f8bb05804c0af), [`a8d5286`](https://github.com/ieedan/implement/commit/a8d528668fb5ac32d63d9e36fad3a81a632e04c5)]:
  - @implementjs/vite@0.0.2
  - @implementjs/router@0.0.11
  - @implementjs/core@0.0.9

## 0.0.12

### Patch Changes

- [#73](https://github.com/ieedan/implement/pull/73) [`090e305`](https://github.com/ieedan/implement/commit/090e305ad38d9c299ea20b99ff2a77bba0754cd3) Thanks [@ieedan](https://github.com/ieedan)! - Hot updates re-render one level of the route instead of remounting the app.

  Every `page.ts` and `layout.ts` now accepts its own updates in dev, and the generated client entry no longer accepts anything. An edit stops at the route file that renders it: kit swaps the component behind that route's module handle and asks the router to rebuild from that file's position in the layout chain, so the layouts above it stay mounted with their DOM, their subscriptions, their state, and the reader's scroll position. A file that is not itself a route lands on the route files that import it; anything that reaches no route file reloads the page, which is also what a `server.ts`, `page.server.ts`, `layout.server.ts` or `hooks.server.ts` edit now does rather than leaving the page on data the edit replaced.

  `@implementjs/router` gains `refreshRouters(depthFor)`, the seam kit drives for this. A route module's handle is also now declared once per module id rather than replaced on every re-declaration: the generated router module re-evaluates whenever anything it imports does — a view importing `router` for a `Link` puts it back in the chain of its own update — and a second handle stranded the route table the mounted router was built from.

- Updated dependencies [[`090e305`](https://github.com/ieedan/implement/commit/090e305ad38d9c299ea20b99ff2a77bba0754cd3)]:
  - @implementjs/router@0.0.10

## 0.0.11

### Patch Changes

- [#70](https://github.com/ieedan/implement/pull/70) [`dc8afec`](https://github.com/ieedan/implement/commit/dc8afec501579ce02c509d21252a94da9935211d) Thanks [@ieedan](https://github.com/ieedan)! - Resolve `@implementjs/router` from kit rather than from the app. The generated `$implement/router` module imports the router by name and `$implement-params.d.ts` augments its `ParamTypes`, both from inside the app — so until now the app had to depend on the package to make either resolve, and could drift onto a different copy than the one kit generated against. Kit now aliases the name at its own copy in both Vite and the generated tsconfig, which an app's own `alias` entries still override.

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
