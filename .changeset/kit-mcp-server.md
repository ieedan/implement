---
"@implementjs/kit": patch
---

Add `@implementjs/kit/mcp`: an MCP server as a route. `mcp()` turns a set of tools into the `POST`/`GET`/`DELETE` handlers a `server.ts` re-exports, `tool()` declares one tool from a Standard Schema and a function, and `tool.fromEndpoint()` exposes an existing validated endpoint as a tool under its own schemas. The protocol — JSON-RPC framing, `initialize` and version negotiation, the Origin check, the RFC 9728 `WWW-Authenticate` challenge that starts OAuth — is handled once, and `tools/list` converts input schemas through the same vendor detection the OpenAPI document uses.
