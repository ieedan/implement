# @implementjs/eslint

## 0.0.2

### Patch Changes

- [#75](https://github.com/ieedan/implement/pull/75) [`b12644e`](https://github.com/ieedan/implement/commit/b12644e742fd3b66b98d1c6407e3a65bb6090995) Thanks [@ieedan](https://github.com/ieedan)! - The `role` rules only read objects that are element props.

  `role` is an ordinary word — a database column, a config key, a test fixture — and `valid-role` reported on every object literal that had one, so `db.insert(members).values({ userId, role: "admin" })` in a server file came back as `"admin" is not an ARIA role` with a disable comment the only way out. `valid-role`, `role-has-required-aria-props` and `role-supports-aria-props` now require the object to be in element-props position first: the first argument of one of core's element helpers, or the second of a `component(tag, props)`. `no-redundant-roles` already asked for an element and now recognises the `component()` shape too. The cost is reach — props built up in a variable and passed in later go unchecked — which is the trade the rest of these rules already make.

## 0.0.1

### Patch Changes

- [`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed) Thanks [@ieedan](https://github.com/ieedan)! - initial setup

- [`6629993`](https://github.com/ieedan/implement/commit/662999342363fb2bbdf37966bb0530c1d084f375) Thanks [@ieedan](https://github.com/ieedan)! - Drop the `Html`, `Head`, `Body`, `Base` and `Noscript` element factories.
