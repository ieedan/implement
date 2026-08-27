---
"@implementjs/adapter-iis": patch
---

Give iisnode an entry it can `require()`, and default `hosting` to `"httpPlatform"`

The adapter defaulted to `hosting: "iisnode"` and wrote an ESM output — `dist/package.json` is `{"type": "module"}` and `dist/index.js` imports the server. iisnode's `interceptor.js` loads the app with `require()`, so the default configuration produced a `dist/` that terminated on start with `ERR_REQUIRE_ESM`, on every app, before a single request was served. There was no option to emit anything else, so a server that only has iisnode had no way through at all.

Under `hosting: "iisnode"` the adapter now writes `index.cjs` beside the entry and points `web.config` — the handler mapping and the rewrite rule — at that. `.cjs` is CommonJS whatever the enclosing `package.json` says, so it is a file iisnode can require, and it reaches the ESM entry through a dynamic `import()`, which CommonJS has always been allowed to do. iisnode retries the named pipe until the process is listening, so the import resolving a tick later is not a race. `index.js` and `handler.js` are unchanged, and `watchedFiles` picks up `*.cjs` so a redeploy still recycles the app pool.

`hosting` now defaults to `"httpPlatform"`. HttpPlatformHandler runs `node.exe index.js` as a process and reverse-proxies to it over a socket: module format never arises, it is Microsoft's own and still supported, and a streamed response reaches the visitor as it is written rather than being buffered by iisnode's named pipe. `hosting: "iisnode"` is still there for a server that has that module and not the other — it now works.

Its `requestTimeout` default moves from `00:04:00` to `00:20:00`. Four minutes is a cut an SSE stream or a long download reaches while it is still working, and it is now the default hosting mode; an app that streams for longer passes its own through `httpPlatform: { requestTimeout: "01:00:00" }`.
