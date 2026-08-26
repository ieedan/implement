---
"@implementjs/kit": patch
---

`[id=integer]` and `[price=number]` work with nothing in `src/params`. Every app that wanted a numeric param had to write the same matcher file first, and once a matcher had to be a schema that was a few more lines than it was worth for the two cases everybody reaches for. They are ordinary matchers, so a route naming one is not special in any way — the param is a `number` in the page, the load, the handler, the generated client and the OpenAPI document, and both read a segment the way `Number` does rather than policing how it is written. What they turn down is what `Number` invents rather than refuses: `NaN` for a segment that is not a number, `Infinity` for one too large to hold, and a fraction where a whole number was asked for.

A `src/params/integer.ts` of your own still wins, so these are defaults rather than reserved words — the app's matchers are spread over the built-ins wherever the two meet, in the runtime table, in `./$types`, and in the router's `ParamTypes`. Kit cannot depend on a schema library, so the built-ins implement Standard Schema directly, which is also what an app does when it would rather not add one; they carry their own JSON Schema, since a converter is per-vendor and kit's own schemas have no vendor package to convert them.
