---
title: MCP Server
description: Your app as tools a model can call — declared like endpoints, validated by the same schemas, protocol handled once.
section: Guides
order: 16
---

[MCP](https://modelcontextprotocol.io) is how AI clients — Claude, Cursor, and everything speaking the protocol — call your product: you expose _tools_, a model reads their descriptions and calls them. The protocol underneath is JSON-RPC over HTTP with its own handshake, version negotiation, security checks, and OAuth discovery dance, and none of it is specific to your app.

`mcp()` handles that part once. What you write is the part no framework can: which tools exist, what they are called, and what they do.

```ts
// src/routes/mcp/server.ts
import * as v from "valibot";
import { mcp, tool } from "@implementjs/kit/mcp";
import { db } from "@/lib/db";

const getPost = tool({
	name: "get_post",
	description: "Fetch one post in full by its id.",
	input: v.object({ id: v.string() }),
	handle: async ({ input }) => await db.post(input.id),
});

export const { POST, GET, DELETE } = mcp({
	serverInfo: { name: "blog", version: "1.0.0" },
	instructions: "A blog. Posts are markdown; ids come from list_posts.",
	tools: [getPost],
});

export const openapi = false;
```

That route is a complete MCP server. Point a client at `https://your-app.com/mcp` and it connects, lists the tools, and calls them — `initialize` and the protocol-version handshake, `ping`, `tools/list`, and `tools/call` are all answered for you.

The server is stateless and JSON-only, which the spec's Streamable HTTP transport explicitly allows: no SSE stream, no session ids, nothing pushed to the client. The route stays a pure function of one request, so it runs anywhere kit runs — the serverless [adapters](/kit/adapters) included.

The `openapi = false` is worth keeping: this route speaks JSON-RPC, and the [OpenAPI document](/kit/api-routes) has nothing true to say about it.

## Declaring tools

`tool()` is to a tool what [`handler()`](/kit/api-routes) is to an endpoint — a schema for the input, a function for the work:

```ts
const createIssue = tool({
	name: "create_issue",
	description: "File a new issue. Call list_teams first if you do not know the teamKey.",
	input: v.object({
		teamKey: v.pipe(v.string(), v.maxLength(6)),
		title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
		description: v.optional(v.string(), ""),
	}),
	annotations: { readOnlyHint: false },
	handle: async ({ input, event }) => await db.createIssue(event.locals.user, input),
});
```

`input` is anything implementing [Standard Schema](https://standardschema.dev) — the same contract `handler()` and [`defineEnv`](/kit/environment-variables) take. It does two jobs: every call's arguments are validated against it before `handle` runs, and `tools/list` converts it to the JSON Schema the model reads, through the same per-vendor detection the OpenAPI document uses. Declare no `input` and `handle`'s `input` is `undefined` — an undeclared input is never read, exactly like an endpoint's undeclared body.

`handle` receives the validated input and the route's own [`RequestEvent`](/kit/server-routes) — `locals`, `cookies`, `fetch`, all of it — so whatever your [hooks](/kit/hooks) establish for a request is there for a tool call too.

The `description` is the part to spend time on. A schema says what the arguments are; only prose says what the tool does, when to reach for it, and what to call first. Write it to the model, because that is who reads it. `instructions` on `mcp()` is the same thing for the server as a whole.

### What a tool returns

|                            | What the model sees                                      |
| -------------------------- | -------------------------------------------------------- |
| any value                  | the value, serialized as JSON                            |
| a `string`                 | the text, as it is                                       |
| `undefined` / `null`       | success, with nothing to say                             |
| `tool.failure("…")`        | a failed result carrying the message                     |
| a thrown `error(404, "…")` | a failed result: `… (HTTP 404)` — same as in an endpoint |

Failures a model can act on are failed _results_, not protocol errors: input the schema rejects comes back naming every issue, the same formatting an endpoint's `400` uses, so the model corrects the call and retries instead of guessing. A protocol error is reserved for a conversation that is actually broken — malformed JSON, an unknown method.

Prefer `tool.failure()` for the failures a tool expects — an issue that does not exist, a name already taken. Throwing works, but a return says the failure was part of the tool's contract.

## Reusing endpoints

Most tools are an existing endpoint wearing a description. `tool.fromEndpoint()` makes that spelling direct — the handler's own schemas become the tool's input, so there is nothing to restate and nothing to drift:

```ts
import * as issues from "../api/issues/[id]/server.ts";

const updateIssue = tool.fromEndpoint(issues.PATCH, {
	name: "update_issue",
	description: "Change an issue's title or status.",
	path: "/api/issues/[id]",
});
```

The tool's input is an envelope of the parts the handler declares — `{ params, query, body }` — and `tools/list` documents each from the handler's schemas, with the route's own path params filled in as strings where no schema narrows them.

A call dispatches through the handler _by function call_, not by HTTP: kit builds the request the input describes, hands it to the handler with this route's `locals` and `cookies`, and the handler's validation, permissions, and side effects run exactly as a real request's would. One implementation of every rule, no socket in between — the same property [`event.api`](/kit/api-routes) has. A non-2xx response comes back as a failed result carrying the endpoint's own error message.

`method` defaults to `POST` when the handler declares a body and `GET` otherwise; pass it when the handler cares which verb it answered.

> [!NOTE]
> Kit deliberately does not turn your whole route table into tools. Which operations a model may call, what they are named, and how they are described are product decisions — and a good tool set is curated, not generated. `fromEndpoint` makes the curating cheap.

## Auth

An open server needs nothing. To require auth, pass `authorize` — it reads the event your `hooks.server.ts` already populated:

```ts
export const { POST, GET, DELETE } = mcp({
	serverInfo: { name: "tracker", version: "1.0.0" },
	tools,
	authorize: (event) => event.locals.agent !== null,
});
```

`false` answers `401` with the `WWW-Authenticate: Bearer resource_metadata="…"` challenge [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) defines and the MCP spec requires. That header is how a client discovers where to authenticate — without it, the client does not fail loudly; it connects, shows zero tools, and offers no way to log in. `authorize` runs before the body is parsed, because an unauthenticated client needs the challenge, not a parse error.

The challenge points at `/.well-known/oauth-protected-resource` by default (`resourceMetadata` changes the path). Serving that document — and issuing and validating the tokens it leads to — stays your app's business: kit checks nothing itself, it asks `authorize`, and your hooks decide what a bearer token means the same way they decide what a session cookie means.

## What the transport does for you

- **Version negotiation.** `initialize` answers in the client's protocol version when it is one kit speaks, so an older client is not forced to downgrade the connection itself. A request without the `MCP-Protocol-Version` header is assumed to be from a pre-header client and accepted, as the spec says.
- **Origin checking.** The DNS-rebinding protection the transport spec requires — with the nuance that native clients are not websites: `vscode-file://vscode-app`, a literal `"null"`, and an absent header all pass, because answering them `403` is what makes a client show "connected, zero tools" instead of starting OAuth.
- **The stateless posture.** `GET` and `DELETE` answer `405` — the spec's way of saying "no server-initiated stream, no session", which clients treat as a description, not a failure. Notifications get the bare `202` the spec asks for; batched requests are rejected, as the current protocol requires.
- **Unconvertible schemas degrade, validation does not.** A schema whose vendor kit cannot convert lists as unconstrained with a warning naming the tool — same posture as the OpenAPI document — while every call is still validated against the real schema.

One cost to know about, the same one as `api.openapi.path`: a route defining tools pulls your schema library and its JSON-Schema converter into the production server bundle, because `tools/call` validates at runtime. That is inherent to being an MCP server, not overhead kit adds.

## Connecting a client

The server's URL is just the route. For Claude Code:

```sh
claude mcp add --transport http blog https://your-app.com/mcp
```

Anything else speaking Streamable HTTP configures the same URL. In dev it is `http://localhost:5173/mcp`, and the dev server answers it like any other route.
