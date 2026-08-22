# Security Audit: @implementjs/kit

**Date:** 2026-08-22
**Scope:** `packages/kit/src/**`, `packages/vite/src/inject.ts` (SSR data path), and the server adapters `packages/adapter-node`, `packages/adapter-vercel`, `packages/adapter-cloudflare`
**Method:** Manual source review of every security-critical code path — the request pipeline (`server.ts`), validated endpoints (`endpoint.ts`), the Node HTTP bridge and static serving (`node.ts`), environment-variable handling (`env.ts`), the server-file import guard (`guard.ts`), SSR data injection (`vite/inject.ts`), route matching (`match.ts`), error handling (`errors.ts`), code generation (`codegen.ts`, `typegen.ts`), OpenAPI generation (`openapi.ts`), and all three server adapters.

Only findings with a concrete exploitation path are listed below. Issues that are theoretical, require app-level misuse, or are mitigated by existing code are omitted per the audit scope.

---

## Medium

### M-1 — Host header injection via default-trusted `Host` and `X-Forwarded-Proto` headers

**Location:** `packages/kit/src/node.ts` — `requestUrl()` (lines 102–116), consumed by `serveApp()` (line 328); default configuration emitted by `packages/adapter-node/src/entry.ts` (lines 47–51).

**Description**

`requestUrl` constructs `event.url` — the URL object every load, endpoint, and hook reads — from client-supplied headers when no fixed `origin` is configured:

```ts
export function requestUrl(req: IncomingMessage, options: OriginOptions = {}): URL {
	const path = req.url ?? "/";
	if (options.origin !== undefined) return new URL(path, options.origin);  // only safe path
	const host = header(options.hostHeader ?? "host") ?? "localhost";
	const forwarded = header(options.protocolHeader ?? "x-forwarded-proto");
	const protocol = forwarded?.split(",")[0]?.trim() ?? (… socket check …);
	return new URL(path, `${protocol}://${host}`);
}
```

The Node adapter's generated entry does not set `ORIGIN` by default:

```ts
serveApp(app, {
	origin: env("ORIGIN", undefined),        // undefined → Host header is trusted
	protocolHeader: env("PROTOCOL_HEADER", undefined), // undefined → x-forwarded-proto trusted
	hostHeader: env("HOST_HEADER", undefined),         // undefined → host header trusted
	address: { header: env("ADDRESS_HEADER", undefined), depth: number("XFF_DEPTH", 1) },
	…
})
```

When `origin` is `undefined` (the default), the app unconditionally trusts the request's `Host` header for the URL origin and `X-Forwarded-Proto` for the protocol. There is no allowlist, no `trustProxy` gate, and no production warning when `ORIGIN` is unset. An attacker who can reach the Node server — directly (the server binds to `0.0.0.0` by default) or through a reverse proxy that forwards the client's `Host` header (nginx's default) — can set `Host: evil.example.com` and make `event.url.origin` resolve to `http://evil.example.com`.

**Impact**

Any application code that builds an absolute URL from `event.url.origin` produces an attacker-controlled URL. Concrete exploitation:

- **Password-reset poisoning** — a load or endpoint constructs `${event.url.origin}/reset?token=…` and emails it; the token is sent to the attacker's domain.
- **Open redirect** — redirects to `${event.url.origin}/dashboard` send the victim to an attacker-controlled site.
- **OAuth callback hijacking** — OAuth redirect URIs built from `event.url.origin` point to the attacker's domain.
- **Cache poisoning** — a CDN caching a response keyed on the URL serves the poisoned response to other users.

This is a recognized vulnerability class (OWASP "Host Header Injection"). The Vercel and Cloudflare adapters are not affected: Vercel's platform overwrites forwarded headers before the function sees them, and Cloudflare constructs the `Request` in the worker runtime (the adapter passes it directly to `handler`, bypassing `requestUrl`).

**Exploitation conditions**

1. App deployed with the Node adapter (the default and most common server adapter).
2. `ORIGIN` environment variable not set (the default).
3. Node server reachable by the attacker — either directly (default bind `0.0.0.0:3000`) or through a proxy that forwards the client `Host` header without overwriting it.
4. Application code uses `event.url.origin` (or `event.url` with absolute resolution) to construct a URL that reaches a user — a common pattern for email links, redirects, and OAuth callbacks.

**Recommendation**

Pick one or more of the following, in order of preference:

1. **Pin the origin in production by default.** The Node adapter entry should set `origin` to a configured value (or derive it from `PROTOCOL_HEADER`/`HOST_HEADER` only when explicitly enabled), rather than defaulting to trusting the raw `Host` header. At minimum, emit a startup warning when `NODE_ENV=production` and `ORIGIN` is unset.
2. **Add an `allowedHosts` option** to `requestUrl` / `serveApp` that validates the `Host` header against an allowlist and rejects mismatches with a 403, mirroring Django's `ALLOWED_HOSTS` or Vite's `server.allowedHosts`.
3. **Gate forwarded-header trust behind an explicit setting** (e.g., `trustProxy: boolean | number`), so that `X-Forwarded-Proto` and `Host` are only honored when the operator has declared that a proxy is in front.

**Existing mitigation (operator action):** Set `ORIGIN=https://your-domain.com` in the deployment environment. This fully resolves the issue by pinning the URL origin regardless of the request headers.

**Status: Fixed.** The Node adapter (`@implementjs/adapter-node`) now fails to start in production when no trusted origin source is configured. The generated `start()` function exits with a diagnostic error if the server binds to a non-loopback address (or a unix socket) under `NODE_ENV=production` and none of `ORIGIN`, `PROTOCOL_HEADER`+`HOST_HEADER`, or `HOST_HEADER` are set. Local development (loopback bind, or no `NODE_ENV=production`) is unaffected. The Vercel adapter was made explicit about trusting `Host`/`X-Forwarded-Proto` (safe on that platform, which overwrites them). See `packages/adapter-node/src/entry.ts`.

---

## Summary

| ID  | Severity | Finding                                                                                                  |
| --- | -------- | -------------------------------------------------------------------------------------------------------- |
| M-1 | Medium   | Host header injection — `event.url` origin is attacker-controlled by default in Node adapter deployments |

## Areas reviewed with no exploitable findings

- **Path traversal** (`node.ts` `resolveFile`, `html.ts` `previewPages`) — `join` + `startsWith(dir + sep)` correctly rejects `..` escapes after URL decoding. Symlink following is inherent to `existsSync` but not exploitable with build-output directories.
- **SSR data injection** (`vite/inject.ts` `serializeData`) — `<` is escaped to `\u003c`, preventing `</script>` breakout in the `<script type="application/json">` tag.
- **Server-file leakage** (`guard.ts`, `env.ts`) — two-layer guard (import prohibition + throwing client stub) prevents server-only values from reaching the browser bundle; `PUBLIC_` prefix enforcement prevents secrets from being inlined into the public env file.
- **Endpoint validation** (`endpoint.ts`) — params, query, and body are all passed through a Standard Schema validator before the handler sees them; response validation runs in non-production by default.
- **Error information disclosure** (`server.ts` `failed`, `errors.ts`) — unexpected errors return `{ message: "Internal Error" }` with no stack trace; details go only to `onError` (server log).
- **Internal fetch recursion** (`server.ts` `internalFetch`) — `MAX_INTERNAL_DEPTH = 8` bounds same-origin recursive fetches.
- **Cookie/authorization forwarding** (`server.ts` `FORWARDED_HEADERS`) — only forwarded on same-origin internal fetches (intended behavior for authenticated server-side requests).
- **Redirect CRLF injection** (`errors.ts` `redirect`) — `Response` headers API rejects CRLF characters.
- **Prototype pollution** (`endpoint.ts` `parseQuery`/`parseForm`) — `__proto__` assignment on a plain object is a no-op for string values; validated output is a fresh object from the schema.
- **OpenAPI disclosure** (`openapi.ts`) — off by default; only generated when `api.openapi` is explicitly configured.
