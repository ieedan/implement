---
"@implementjs/kit": patch
---

Warn about files in the routes tree whose names only just miss a routing one. `+server.ts`, `page.tsx`, and `+page.server.js` are colocated code as far as the scan is concerned, so the route they were meant to be simply never existed and nothing said why. The dev server and the build now print `unknown file "src/routes/api/+server.ts" — did you mean "server.ts"?`, and the dev server says it the moment such a file is written. Genuinely colocated code (`Button.ts`, `layout.css`, `page.test.ts`) stays silent.
