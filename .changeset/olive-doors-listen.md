---
"@implementjs/kit": patch
---

`mcp()` reads an argument the model sent as JSON text.

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
