---
title: role-supports-aria-props
description: An aria property the role does not take is ignored at runtime, which reads worse than leaving it out.
section: Rules
order: 19
---

The other direction from [`role-has-required-aria-props`](/eslint/role-has-required-aria-props): an `aria-*` property the role does not take is simply ignored, which is worse than leaving it out because the code reads as though it works.

```ts
Div({ role: "button", "aria-checked": on }); // button has no checked state
Div({ role: "switch", "aria-checked": on }); // fine
```

Supported sets include everything a role inherits from its superclasses plus the global properties, so `aria-label` and `aria-hidden` are fine everywhere.

Two deliberate silences. An attribute [`aria-query`](https://www.npmjs.com/package/aria-query) has never heard of is left to [`valid-aria`](/eslint/valid-aria) rather than being called unsupported here — a gap in the table should read as no opinion, not as a mistake in your code. And a spread _after_ the `role` key could replace the role this was judged against, so those are skipped too; a spread before it cannot, so they are not.
