---
"@implementjs/kit": patch
---

`@implementjs/kit/mcp`: a tool can answer with image and audio content, not only text. `tool.image(data, mimeType)` and `tool.audio(data, mimeType)` build the blocks the protocol has for bytes — base64 as a string, or `Uint8Array`/`ArrayBuffer` kit encodes — so a tool handing back a screenshot gives the model a picture to look at instead of characters it cannot read. `tool.content(...blocks)` answers with as many blocks as the answer needs, `tool.structured(value, ...blocks)` carries `structuredContent` alongside them, and the exported `ToolResult` widens from text-only to the three block types the spec defines.
