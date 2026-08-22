---
"@implementjs/kit": patch
---

Route param matchers, with the type they produce. A `src/params/<name>.ts`
default-exports a `matcher()`, and a `[id=<name>]` route directory names it: a
segment the matcher turns down is not a match, so the path falls through to the
next route and reaches the error page rather than a handler that has to check
for itself.

A matcher may also _parse_ the segment, and what it returns is what the param is
everywhere downstream — `event.params` in a load or a `server.ts` handler,
`params` in a page or layout, the generated client. The generated `./$types`
read the type off the matcher module, so it is declared once:

```ts
// src/params/integer.ts
import { matcher, mismatch } from "@implementjs/kit/params";

export default matcher((value) => {
	const parsed = Number(value);
	return /^\d+$/.test(value) ? parsed : mismatch;
});
```

```ts
// src/routes/posts/[id=integer]/server.ts
export const GET = handler({ handle: ({ params }) => db.post(params.id) });
//                                                          ^? number
```

`matcher()` takes a pattern (anchored to the whole segment), a parse function, or
a Standard Schema. Matchers live in `src/params` by default — `kit({ params })`
moves them.
