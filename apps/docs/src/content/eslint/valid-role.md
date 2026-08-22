---
title: valid-role
description: A misspelled role, or an abstract one browsers ignore.
section: Rules
order: 17
---

The same idea as [`valid-aria`](/eslint/valid-aria), for the `role` prop, checked against the concrete roles in [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/#role_definitions):

```ts
Div({ role: "buton" });
//          ^ not an ARIA role. Did you mean "button"?
```

ARIA lets `role` hold a space-separated fallback list and uses the first role the browser understands, so every token is checked and the suggestion rewrites only the one that was wrong.

Abstract roles get a message of their own. They exist to organise the ARIA taxonomy, authors are not allowed to use them, and browsers ignore them — but they read like plausible roles, which is exactly why they end up in code:

```ts
Div({ role: "widget" });
//          ^ abstract role; it does nothing on an element
```

As with `valid-aria`, only string literals are checked, and `role` bound to a signal is left alone.

## Options

```ts
"implementjs/valid-role": ["error", { extraRoles: ["doc-chapter"] }]
```

`extraRoles` adds roles from a vocabulary outside core ARIA — [DPUB-ARIA](https://www.w3.org/TR/dpub-aria-1.1/) and [graphics-aria](https://www.w3.org/TR/graphics-aria-1.0/) are the usual reasons.
