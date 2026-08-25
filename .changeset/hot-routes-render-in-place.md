---
"@implementjs/kit": patch
"@implementjs/router": patch
---

Hot updates re-render one level of the route instead of remounting the app.

Every `page.ts` and `layout.ts` now accepts its own updates in dev, and the generated client entry no longer accepts anything. An edit stops at the route file that renders it: kit swaps the component behind that route's module handle and asks the router to rebuild from that file's position in the layout chain, so the layouts above it stay mounted with their DOM, their subscriptions, their state, and the reader's scroll position. A file that is not itself a route lands on the route files that import it; anything that reaches no route file reloads the page, which is also what a `server.ts`, `page.server.ts`, `layout.server.ts` or `hooks.server.ts` edit now does rather than leaving the page on data the edit replaced.

`@implementjs/router` gains `refreshRouters(depthFor)`, the seam kit drives for this. A route module's handle is also now declared once per module id rather than replaced on every re-declaration: the generated router module re-evaluates whenever anything it imports does — a view importing `router` for a `Link` puts it back in the chain of its own update — and a second handle stranded the route table the mounted router was built from.
