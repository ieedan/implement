---
"@implementjs/core": patch
---

Serialize `Portal` output after the app tree so hydration can claim the server
markup.

The server render mounted into `document.body`, which is also where `Portal`
sends its children, so portal output landed wherever the portal happened to
mount — for a toaster in a root layout, ahead of the rest of the page. The
client mounts its portals into the real `document.body`, outside the `[data-ssr]`
wrapper, so its claim cursor met the portal's markup where it expected the
page's own and failed the pass, discarding the server render and remounting the
whole tree. The render now mounts into a wrapper inside the server body, the way
the client mounts into the injected `[data-ssr]` wrapper, so portal output
serializes past the end of the app tree, where the leftover sweep removes it.
