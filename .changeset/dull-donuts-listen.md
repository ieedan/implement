---
"@implementjs/kit": patch
---

Bundle the JSON-Schema converters an app has installed, so an MCP route serves real tool schemas in production

`tools/list` converts each tool's `input` through the vendor's own converter package (`zod`, `@valibot/to-json-schema`), reached by a dynamic import whose specifier was a variable. The bundler never saw it, so the converter was left out of the server bundle — and an adapter that ships a self-contained bundle has no `node_modules` for the bare specifier to resolve against, so every conversion failed. Each failure was swallowed into a `console.warn` and an unconstrained `{"type":"object"}`: the model saw every tool's name and description and not one of its arguments. Dev and `vite preview` resolved the package from disk, so it only happened once deployed.

Kit's Vite plugin now emits `$implement/schema-converters`, a static import of each converter package the app actually has, and the conversion reads from that — so what the build sees is what ships. The same path backs `tool.fromEndpoint` and the live `api.openapi.path` route.

A converter that cannot be reached, or that throws on a schema, now fails `tools/list` with the tool's name and the reason instead of listing the tool with no arguments. A vendor kit has no converter for still degrades to an unconstrained schema with a warning — nothing kit can do about that one — and `inputJsonSchema` is documented as the way to publish a schema yourself.
