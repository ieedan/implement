---
"@implementjs/kit": patch
---

Prebundle `@implementjs/core` in dev alongside the router and runtime. In a workspace where core is linked, the prebundled router carried its own copy of it, so a link changed the URL but the router never rendered the new page, and every server render was discarded as a hydration mismatch.
