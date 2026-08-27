---
"@implementjs/kit": patch
"@implementjs/adapter-node": patch
"@implementjs/adapter-iis": patch
"@implementjs/adapter-cloudflare": patch
"@implementjs/adapter-vercel": patch
"@implementjs/adapter-static": patch
---

Add WebSocket routes: a `server.ts` can export a `socket()` handler as `SOCKET` and accept an upgrade beside its method handlers.

An upgrade runs through the same pipeline a request does — `hooks.server.ts`, cookies, `event.locals` — and the route's own `upgrade` callback gets the last word, so refusing one is `error(401, …)`. Handlers receive a peer with `send`, `close`, `params`, `locals`, a `signal` that aborts on disconnect, and `bufferedAmount`/`drained()` for backpressure; messages are sequenced so a slow handler holds the next one.

Both directions can be typed. `socket({ incoming, outgoing })` takes Standard Schemas, the same contract `handler()` uses for `body` and `response`: `incoming` is validated on the server and types `message.data`, `outgoing` types `peer.send` and serializes as JSON, and an `on` map dispatches a tagged union member by member with every member required. No envelope is invented — it is a tagged union over plain JSON.

The generated client gains `api.SOCKET("/api/room/[id]", { params })`, typed off the route's schemas and offered only for paths that serve one. It builds the URL from the params, reads messages by async iteration (as it already does for `sse`), exposes `status` as a `Readable` to bind a connection indicator to, and reconnects with a backoff — without pretending that is transparent: unsent messages are dropped rather than replayed, and `onReconnect` is where per-connection state goes back.

`adapter-node` and `adapter-iis` serve sockets through a `node:http` upgrade listener (`attachSockets` mounts it on a server you built yourself, and the IIS `web.config` now hands the handshake to Node), and `adapter-cloudflare` through the runtime's `WebSocketPair`. `adapter-vercel` and `adapter-static` fail the build when an app declares a socket route, rather than deploying one that would 404.
