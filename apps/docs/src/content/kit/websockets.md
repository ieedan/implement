---
title: WebSockets
description: A duplex channel on a route — accept an upgrade, read and write messages, and know when the client is gone.
section: Guides
order: 16
---

Some work needs both directions of one connection: live collaboration, presence, log tailing, an agent transport, a relay. [Server-sent events](/kit/server-routes#streaming) give you a stream downstream and nothing upstream, and pairing one with a `POST` upstream runs into the browser's six-connection-per-origin limit long before it runs into anything about your app.

A `server.ts` can accept a **WebSocket upgrade** instead. Export a `socket()` handler as `SOCKET`, beside the method handlers the same file already exports:

```ts
// src/routes/api/room/[id]/server.ts
import { socket } from "./$types";

export const SOCKET = socket({
	open: (peer) => join(peer.params.id, peer),
	message: (peer, message) => broadcast(peer.params.id, message.text()),
	close: (peer) => leave(peer.params.id, peer),
});
```

```ts
const ws = new WebSocket(`ws://localhost:5173/api/room/${id}`);
ws.addEventListener("message", (event) => render(event.data));
ws.send("hello");
```

An upgrade goes through the same pipeline a request does: [`hooks.server.ts`](/kit/hooks) runs, cookies are read and written, `event.locals` is filled in — and only then is the connection accepted. A directory that serves a socket may still export `GET` and the rest; an upgrade request is routed to `SOCKET`, and an ordinary request to the same path is routed to the method handler as usual.

## The peer

Every connection is a **peer**, and it is what a handler holds on to.

|                         |                                                                         |
| ----------------------- | ----------------------------------------------------------------------- |
| `id`                    | a per-connection id, unique in this process — the key to hang state off |
| `params`                | the route's params, typed by the generated `./$types`                   |
| `url`                   | the URL the upgrade was requested at, query string included             |
| `request`               | the upgrade request, for its headers                                    |
| `locals`                | whatever `hooks.server.ts` put on the event that accepted this upgrade  |
| `signal`                | aborts when the connection is gone                                      |
| `readyState`            | the four states `WebSocket` itself defines                              |
| `bufferedAmount`        | bytes sent but not yet written out                                      |
| `send(data)`            | queues a message; answers with `bufferedAmount` after queueing          |
| `close(code?, reason?)` | starts the close handshake                                              |
| `drained(limit?)`       | resolves once `bufferedAmount` is at or under `limit`                   |

Two connections from the same browser are two peers. That is the point — `id` is what a room, a presence list, or a job table is keyed by.

`send` takes a string or bytes, and the distinction survives the wire: a string arrives as a text frame and a `Uint8Array` or `ArrayBuffer` as a binary one. A message read back keeps the same distinction — `message.data` is a `string` or a `Uint8Array`, `message.binary` says which, and `text()`, `json<T>()`, `uint8Array()`, and `arrayBuffer()` convert on demand, so a relay that only forwards bytes never pays to decode them.

Sending on a peer that has already gone is a no-op rather than an error. The client hanging up is not the sender's bug, and there is no useful way to have handled it.

### The single-function form

When all a route does is write, the callbacks are more ceremony than the job needs. `socket()` also takes a bare function, which is the `open` callback, handed the peer and the signal that aborts when it disconnects:

```ts
export const SOCKET = socket(async (peer, signal) => {
	for await (const tick of ticks(signal)) peer.send(JSON.stringify(tick));
});
```

That signal is the one thing worth taking care over, exactly as it is for [`sse`](/kit/server-routes#ending-one): a loop parked on a promise that never settles outlives the client it was writing to. Wait under the signal and the disconnect is what wakes you.

## Refusing an upgrade

A socket that anyone can open is a socket anyone can open. The route's `upgrade` callback runs with the app's hooks already applied — so `event.locals` is filled in — and this is where a socket route authenticates:

```ts
export const SOCKET = socket({
	upgrade: ({ locals, params }) => {
		if (locals.user === undefined) error(401, "sign in first");
		if (!canRead(locals.user, params.id)) error(403, "not your room");
	},
	open: (peer) => join(peer.params.id, peer),
});
```

`error(…)` refuses the handshake with that status; returning a `Response` does the same with a response of your own. Either way the connection is never established, and the client sees a handshake that failed with the status on it. `hooks.server.ts` can refuse one too, by answering with its own response instead of calling `resolve` — the same shape as refusing any other request.

A `params` schema works the same way it does for [`handler()`](/kit/api-routes), and a rejection is a `400`:

```ts
export const SOCKET = socket({
	params: z.object({ id: z.coerce.number() }),
	open: (peer) => peer.send(`room ${peer.params.id}`), // a number
});
```

Cookies a hook set on the way in go out with the handshake. So does anything a route added through `event.setHeaders`, which is how a route selects a `Sec-WebSocket-Protocol`.

## Lifecycle

**Messages are sequenced.** Each callback is queued behind the one before it, so an `async` `message` handler holds the next message rather than racing it. A frame that sets up state cannot be overtaken by the frame that uses it — which is what makes a protocol of your own tractable over the channel.

**A disconnect is observable, and it is where per-connection state is released.** `close` runs with the code and reason the client sent, and `clean` says whether the close handshake actually completed or the socket simply died:

```ts
export const SOCKET = socket({
	open: (peer) => sessions.set(peer.id, newSession(peer)),
	close: (peer, { code, reason, clean }) => {
		sessions.delete(peer.id);
		if (!clean) log.warn(`peer ${peer.id} vanished (${code})`);
	},
});
```

A socket that died without a close frame reports `1006` and `clean: false` — the code the protocol reserves for exactly that, and one no peer can send. `peer.signal` aborts immediately after `close` runs, so a handler still sees the peer whose state it is releasing, and anything waiting on the signal wakes once that is done.

**A server restart ends every connection.** There is no session to resume and nothing kit keeps across one: sockets live in the process, and a deploy, a crash, or an app pool recycle takes them all with it. Clients reconnect — a browser's `WebSocket` does not do it for you, unlike `EventSource`, so a reconnect loop is yours to write — and they arrive as new peers with new ids. Per-connection state is therefore exactly that: anything that has to outlive a connection belongs somewhere a restart does not reach.

**Idle connections are held open, and dead ones are dropped.** Kit pings every 30 seconds, and a peer that has not answered by the time the next ping is due is dropped — so a connection whose other end vanished is noticed within a minute rather than held open indefinitely with whatever state the app built for it. A proxy in front may have an idle timeout of its own that is shorter.

## Backpressure

A duplex API that gives no flow-control signal just relocates the problem, so `peer.send` answers with what is still queued and `peer.drained` waits for it to clear:

```ts
for await (const chunk of source) {
	// over a megabyte queued: stop reading the source until the socket catches up
	if (peer.send(chunk) > 1_000_000) await peer.drained(1_000_000);
}
```

`drained(limit)` resolves as soon as `bufferedAmount` is at or under `limit`, and resolves immediately if it already is — or if the peer has closed, so a producer awaiting it is never stranded on a connection that is gone.

The signal is only as good as the host underneath it. A Node server reports the socket's real write buffer. Cloudflare's `WebSocket` has none to report, so `bufferedAmount` is always `0` there and `drained` always resolves at once — flow control on Workers has to be a credit scheme over the channel itself (the consumer sends "send me N more") rather than a read of the socket.

## Where a socket can live

| Host                                             | Sockets                                                      |
| ------------------------------------------------ | ------------------------------------------------------------ |
| dev, and [`adapter-node`](/kit/adapters#node)    | yes — the generated server attaches an `upgrade` listener    |
| [`adapter-iis`](/kit/adapters#iis)               | yes — `web.config` hands the handshake to Node               |
| [`adapter-cloudflare`](/kit/adapters#cloudflare) | yes — through the runtime's own `WebSocketPair`              |
| [`adapter-vercel`](/kit/adapters#vercel)         | no — the build fails rather than deploying a route that 404s |
| [`adapter-static`](/kit/adapters#static)         | no — the build fails, for the same reason                    |

The two that cannot serve one say so at build time, naming the routes:

```
@implementjs/adapter-vercel: this app declares WebSocket routes, and a
serverless function cannot hold a socket open:
  api/room/[id]/server.ts
```

That is deliberate. A serverless function answers one request and is frozen; there is no upgrade path into it, so a socket route deployed there would not fail at deploy time — it would 404 in production, which is a worse way to find out.

### Node

Nothing to configure: the server `@implementjs/adapter-node` writes attaches the `upgrade` listener itself. To mount the app inside a server you already have, `attachSockets` is the seam:

```js
import { createServer } from "node:http";
import { attachSockets, handler } from "./dist/handler.js";

const server = createServer(handler);
attachSockets(server);
server.listen(3000);
```

A path no socket route claims is left alone, so a server with an upgrade path of its own keeps it. Kit speaks version 13 and negotiates no extensions, so a client offering `permessage-deflate` falls back to uncompressed frames — which is what the protocol says to do.

### IIS

IIS ships its own WebSocket module, and while it is on it answers the handshake itself: the upgrade never reaches Node, and the route is never asked. The adapter writes `<webSocket enabled="false" />` into `web.config` when the app has socket routes, which is what makes the handler in front proxy the connection through instead. The **WebSocket Protocol** Windows feature still has to be installed on the server — that setting says IIS is not the one speaking the protocol, not that the protocol is unavailable.

### Cloudflare

A worker keeps one half of a `WebSocketPair` and returns the other in the `101`. Waiting costs no CPU time, so an idle connection is close to free — but it lives only as long as the worker instance does, and nothing carries it across a deploy. For a connection that has to outlive one, or for many peers that have to see each other's messages, reach for a Durable Object and use the route to route into it.

## In dev

Socket routes work in `vite dev` exactly as they do in production, on the same port — the same hooks, the same `upgrade` callback, the same refusals. Vite's own HMR channel is on that server too, and kit leaves it alone.

An upgrade to a path no socket route claims is dropped rather than left hanging, so a typo'd path fails the handshake here the way it would in production instead of waiting forever for an answer that is not coming.

Editing a `server.ts` does not migrate the connections it is holding — the module reloads, and the peers on the old one stay on the old one until they reconnect. Reload the client after changing a socket route.
