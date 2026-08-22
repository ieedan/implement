---
"@implementjs/primitives": patch
---

Generate ids without `nanoid`, so the bundle runs in a browser.

`nanoid@6` resolves to its Node build when it is bundled — that build reaches for
`Buffer.allocUnsafe`, so the first primitive to call `getId()` threw
`ReferenceError: Buffer is not defined` on the client. `getId()` now draws its
four characters from `crypto.getRandomValues` over the same 64 character
alphabet, which every target already has, and the package has no runtime
dependency beyond `@implementjs/core`.
