---
title: role-has-required-aria-props
description: Twelve ARIA roles are incomplete without a particular property; this is the rule that notices.
section: Rules
order: 18
---

Twelve ARIA roles are incomplete without a particular property. A `role="checkbox"` with no `aria-checked` announces itself as a checkbox and then cannot say whether it is ticked:

```ts
Div({ role: "checkbox" }); // reported: requires `aria-checked`
Div({ role: "checkbox", "aria-checked": checked }); // fine
```

The requirement lists come from [`aria-query`](https://www.npmjs.com/package/aria-query) — the same data `eslint-plugin-jsx-a11y` and Svelte's compiler warnings read — rather than being copied into this repo, because the spec's inheritance graph is not something worth hand-maintaining. Some of it is genuinely surprising: `slider` requires only `aria-valuenow`, not the whole min/max trio, and `separator` requires nothing at all.

A props object containing a spread is skipped, since the property this looks for might be arriving inside it. So is any object that is not [in element-props position](/eslint/how-rules-work) — a `role` column on a database row is a word, not a checkbox.
