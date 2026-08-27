# @implementjs/adapter-static

## 0.0.19

### Patch Changes

- [#96](https://github.com/ieedan/implement/pull/96) [`08908b3`](https://github.com/ieedan/implement/commit/08908b347b9080f7bf808e43ddaa7853770ce9d0) Thanks [@ieedan](https://github.com/ieedan)! - Add WebSocket routes: a `server.ts` can export a `socket()` handler as `SOCKET` and accept an upgrade beside its method handlers.

  An upgrade runs through the same pipeline a request does — `hooks.server.ts`, cookies, `event.locals` — and the route's own `upgrade` callback gets the last word, so refusing one is `error(401, …)`. Handlers receive a peer with `send`, `close`, `params`, `locals`, a `signal` that aborts on disconnect, and `bufferedAmount`/`drained()` for backpressure; messages are sequenced so a slow handler holds the next one.

  Both directions can be typed. `socket({ incoming, outgoing })` takes Standard Schemas, the same contract `handler()` uses for `body` and `response`: `incoming` is validated on the server and types `message.data`, `outgoing` types `peer.send` and serializes as JSON, and an `on` map dispatches a tagged union member by member with every member required. No envelope is invented — it is a tagged union over plain JSON.

  The generated client gains `api.SOCKET("/api/room/[id]", { params })`, typed off the route's schemas and offered only for paths that serve one. It builds the URL from the params, reads messages by async iteration (as it already does for `sse`), exposes `status` as a `Readable` to bind a connection indicator to, and reconnects with a backoff — without pretending that is transparent: unsent messages are dropped rather than replayed, and `onReconnect` is where per-connection state goes back.

  `adapter-node` and `adapter-iis` serve sockets through a `node:http` upgrade listener (`attachSockets` mounts it on a server you built yourself, and the IIS `web.config` now hands the handshake to Node), and `adapter-cloudflare` through the runtime's `WebSocketPair`. `adapter-vercel` and `adapter-static` fail the build when an app declares a socket route, rather than deploying one that would 404.

- Updated dependencies [[`08908b3`](https://github.com/ieedan/implement/commit/08908b347b9080f7bf808e43ddaa7853770ce9d0)]:
  - @implementjs/kit@0.0.19

## 0.0.18

### Patch Changes

- Updated dependencies [[`a16600b`](https://github.com/ieedan/implement/commit/a16600b3170dc5d5df2638a92adee86f80506ee0)]:
  - @implementjs/kit@0.0.18

## 0.0.17

### Patch Changes

- Updated dependencies [[`598c071`](https://github.com/ieedan/implement/commit/598c071b3ce17de9aaaaab69ba443a6157197ea3)]:
  - @implementjs/kit@0.0.17

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
