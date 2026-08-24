---
"create-implement-app": patch
---

Route the csr template with `@implementjs/router`: `src/router.ts` holds the table, `src/layout.ts` the nav both routes render inside, and `src/not-found.ts` the fallback. Views that read `router` annotate their return type, since inferring it would mean inferring `router` from the table that renders them.
