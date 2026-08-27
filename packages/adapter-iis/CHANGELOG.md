# @implementjs/adapter-iis

## 0.0.6

### Patch Changes

- [#96](https://github.com/ieedan/implement/pull/96) [`08908b3`](https://github.com/ieedan/implement/commit/08908b347b9080f7bf808e43ddaa7853770ce9d0) Thanks [@ieedan](https://github.com/ieedan)! - Add WebSocket routes: a `server.ts` can export a `socket()` handler as `SOCKET` and accept an upgrade beside its method handlers.

  An upgrade runs through the same pipeline a request does — `hooks.server.ts`, cookies, `event.locals` — and the route's own `upgrade` callback gets the last word, so refusing one is `error(401, …)`. Handlers receive a peer with `send`, `close`, `params`, `locals`, a `signal` that aborts on disconnect, and `bufferedAmount`/`drained()` for backpressure; messages are sequenced so a slow handler holds the next one.

  Both directions can be typed. `socket({ incoming, outgoing })` takes Standard Schemas, the same contract `handler()` uses for `body` and `response`: `incoming` is validated on the server and types `message.data`, `outgoing` types `peer.send` and serializes as JSON, and an `on` map dispatches a tagged union member by member with every member required. No envelope is invented — it is a tagged union over plain JSON.

  The generated client gains `api.SOCKET("/api/room/[id]", { params })`, typed off the route's schemas and offered only for paths that serve one. It builds the URL from the params, reads messages by async iteration (as it already does for `sse`), exposes `status` as a `Readable` to bind a connection indicator to, and reconnects with a backoff — without pretending that is transparent: unsent messages are dropped rather than replayed, and `onReconnect` is where per-connection state goes back.

  `adapter-node` and `adapter-iis` serve sockets through a `node:http` upgrade listener (`attachSockets` mounts it on a server you built yourself, and the IIS `web.config` now hands the handshake to Node), and `adapter-cloudflare` through the runtime's `WebSocketPair`. `adapter-vercel` and `adapter-static` fail the build when an app declares a socket route, rather than deploying one that would 404.

- Updated dependencies [[`08908b3`](https://github.com/ieedan/implement/commit/08908b347b9080f7bf808e43ddaa7853770ce9d0)]:
  - @implementjs/kit@0.0.19

## 0.0.5

### Patch Changes

- [#94](https://github.com/ieedan/implement/pull/94) [`420c656`](https://github.com/ieedan/implement/commit/420c6569853c2d1ce4571a2bc3dc5dd043e38b03) Thanks [@ieedan](https://github.com/ieedan)! - Give iisnode an entry it can `require()`, and default `hosting` to `"httpPlatform"`

  The adapter defaulted to `hosting: "iisnode"` and wrote an ESM output — `dist/package.json` is `{"type": "module"}` and `dist/index.js` imports the server. iisnode's `interceptor.js` loads the app with `require()`, so the default configuration produced a `dist/` that terminated on start with `ERR_REQUIRE_ESM`, on every app, before a single request was served. There was no option to emit anything else, so a server that only has iisnode had no way through at all.

  Under `hosting: "iisnode"` the adapter now writes `index.cjs` beside the entry and points `web.config` — the handler mapping and the rewrite rule — at that. `.cjs` is CommonJS whatever the enclosing `package.json` says, so it is a file iisnode can require, and it reaches the ESM entry through a dynamic `import()`, which CommonJS has always been allowed to do. iisnode retries the named pipe until the process is listening, so the import resolving a tick later is not a race. `index.js` and `handler.js` are unchanged, and `watchedFiles` picks up `*.cjs` so a redeploy still recycles the app pool.

  `hosting` now defaults to `"httpPlatform"`. HttpPlatformHandler runs `node.exe index.js` as a process and reverse-proxies to it over a socket: module format never arises, it is Microsoft's own and still supported, and a streamed response reaches the visitor as it is written rather than being buffered by iisnode's named pipe. `hosting: "iisnode"` is still there for a server that has that module and not the other — it now works.

  Its `requestTimeout` default moves from `00:04:00` to `00:20:00`. Four minutes is a cut an SSE stream or a long download reaches while it is still working, and it is now the default hosting mode; an app that streams for longer passes its own through `httpPlatform: { requestTimeout: "01:00:00" }`.

## 0.0.4

### Patch Changes

- Updated dependencies [[`a16600b`](https://github.com/ieedan/implement/commit/a16600b3170dc5d5df2638a92adee86f80506ee0)]:
  - @implementjs/kit@0.0.18

## 0.0.3

### Patch Changes

- Updated dependencies [[`598c071`](https://github.com/ieedan/implement/commit/598c071b3ce17de9aaaaab69ba443a6157197ea3)]:
  - @implementjs/kit@0.0.17

## 0.0.2

### Patch Changes

- Updated dependencies [[`c3136ff`](https://github.com/ieedan/implement/commit/c3136ff24c5cdbda4aad32fc5662f909aeed8887), [`589641f`](https://github.com/ieedan/implement/commit/589641fc1e8bbea1b732e12db8953cb9868bb5b5)]:
  - @implementjs/kit@0.0.16

## 0.0.1

### Patch Changes

- [#86](https://github.com/ieedan/implement/pull/86) [`8752858`](https://github.com/ieedan/implement/commit/8752858dd0f064aeb402a9056224954e18c3d1ad) Thanks [@ieedan](https://github.com/ieedan)! - Setup trusted publishing
- Updated dependencies []:
  - @implementjs/kit@0.0.15
