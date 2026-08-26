---
"@implementjs/kit": patch
---

A schema inlined into the OpenAPI document no longer carries a `$schema` of
its own.

Every converter stamps a dialect on what it hands back — draft-07 from
valibot, 2020-12 from zod — declaring the dialect of a document it thinks it
is the root of. Inlined into an operation it is not, and the one kit generates
says `"openapi": "3.1.0"`, whose dialect is 2020-12. So a valibot app shipped a
`"$schema": "http://json-schema.org/draft-07/schema#"` beside every body,
response, and parameter in the document, disagreeing with the document that
contains it — something a strict validator is entitled to complain about.

It now comes off wherever the schema came from: kit's own per-vendor
converters, the built-in matchers behind a `[id=integer]` param, and an app's
own `api.openapi.toJsonSchema`. Only the key is dropped; nothing else about
the converted schema changes.
