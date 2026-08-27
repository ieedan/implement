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

`adapter-node` and `adapter-iis` serve them through a `node:http` upgrade listener (`attachSockets` mounts it on a server you built yourself, and the IIS `web.config` now hands the handshake to Node), and `adapter-cloudflare` through the runtime's `WebSocketPair`. `adapter-vercel` and `adapter-static` fail the build when an app declares a socket route, rather than deploying one that would 404.
