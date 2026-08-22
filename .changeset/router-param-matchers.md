---
"@implementjs/router": patch
---

`:param=<name>` segments, gated by a matcher. `Router(routes, { matchers })`
takes the matchers a tree's keys name; a matcher either turns a segment down —
so matching carries on to the next route — or answers with the value the param
carries, which need not be a string. A matched param outranks a plain one at
the same position, and a key naming a matcher the router was not given throws
when the router is built.

Declare what a matcher produces in the new `ParamTypes` registry and the params
are typed through it:

```ts
declare module "@implementjs/router" {
	interface ParamTypes {
		integer: number;
	}
}

Router({ "/issues/:id=integer": ({ id }) => Issue(id) }, { matchers: { integer } });
//                                           ^? Readable<number>
```
