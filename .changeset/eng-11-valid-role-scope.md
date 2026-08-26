---
"@implementjs/eslint": patch
---

The `role` rules only read objects that are element props.

`role` is an ordinary word — a database column, a config key, a test fixture — and `valid-role` reported on every object literal that had one, so `db.insert(members).values({ userId, role: "admin" })` in a server file came back as `"admin" is not an ARIA role` with a disable comment the only way out. `valid-role`, `role-has-required-aria-props` and `role-supports-aria-props` now require the object to be in element-props position first: the first argument of one of core's element helpers, or the second of a `component(tag, props)`. `no-redundant-roles` already asked for an element and now recognises the `component()` shape too. The cost is reach — props built up in a variable and passed in later go unchecked — which is the trade the rest of these rules already make.
