# @implementjs/formish

## 0.0.6

### Patch Changes

- [#57](https://github.com/ieedan/implement/pull/57) [`b51e829`](https://github.com/ieedan/implement/commit/b51e8295af17c8d72287b71e6e312c50bcc12c4f) Thanks [@ieedan](https://github.com/ieedan)! - Port formish to Formisch proper, rather than modelling its API

  The internals are now Formisch's: a tree of field stores built from the schema, one per
  field, each carrying its own input, baseline, errors and flags. Array methods move an
  item's state with the item instead of remapping names, and element registration replaces
  looking elements up in the DOM by name.

  Everything Formisch exports is now here, with the same configs and semantics:
  `getDeepError`, `getDeepErrors`, `getDeepErrorEntry`, `getDeepErrorEntries`,
  `getDirtyInput`, `getDirtyPaths`, `pickDirty`, `isTouched`, `isEdited`, `isDirty` and
  `isValid`, plus `reset`'s `keepInput` / `keepTouched` / `keepEdited` / `keepErrors` /
  `keepSubmitted`.

  Breaking, where the old API disagreed with upstream:

  - `field.setInput` is now `field.onInput`.
  - `getAllErrors(form)` is now `getDeepErrorEntries(form, config?)`, which also takes a path
    and includes the form's own errors under an empty path.
  - `clearErrors` is gone; `setErrors(form, { path, errors: null })` clears a field. `errors`
    no longer accepts a bare string.
  - `useField`'s `array` option is gone — the schema says which fields hold a list.
  - `emptyInput` defaults to `{ string: "" }`. A required `v.boolean()` now starts missing;
    pass `emptyInput: { boolean: false }` for the old behaviour.
  - `createForm` throws on `v.record`, `v.objectWithRest`, `v.tupleWithRest` and `v.promise`,
    whose fields cannot be known up front, and now walks into `v.union` and `v.variant`.
  - An array method with an index outside the list leaves the list alone; `insert` appends
    only when given no index.
  - `submit(form)` needs a mounted form element, and no longer falls back to validating.

- Updated dependencies [[`00239de`](https://github.com/ieedan/implement/commit/00239de0e84fe27b2f8737e977d973b4d24c454e)]:
  - @implementjs/core@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [[`f60114f`](https://github.com/ieedan/implement/commit/f60114f329cd73c5922a60c8337566afa97d3f21)]:
  - @implementjs/core@0.0.5

## 0.0.4

### Patch Changes

- [#45](https://github.com/ieedan/implement/pull/45) [`c60472f`](https://github.com/ieedan/implement/commit/c60472f9aadaa1ca1a1396eb05d2835f33d9c654) Thanks [@ieedan](https://github.com/ieedan)! - Build the form input from the valibot schema instead of the DOM

  Formish now walks the schema when the form is created and gives every field a
  starting value, rather than filling empty fields in from whatever elements
  happen to be mounted at validation time. A field you forget to render — or one
  behind a collapsed section or an unopened tab — now validates exactly like a
  field that is on screen: with the schema's own message, instead of blocking
  submit over an `undefined` that nothing was ever going to supply.

  `createForm` takes an `emptyInput` option to say where a required field of a
  given type starts. It defaults to `{ string: "", boolean: false }`; optional
  fields stay missing and nullable ones start at `null`.

  **Breaking:** the schema must be a valibot schema. Standard Schema support and
  the `StandardSchemaV1`, `StandardIssue` and `StandardResult` type exports are
  gone, `valibot` is now a peer dependency, and `validate()` returns valibot's
  `SafeParseResult` (`success`/`output`) rather than a Standard Schema result
  (`issues`/`value`). `getInput()` now reports the fields the schema names rather
  than only the ones that were written to.

- Updated dependencies [[`14ce276`](https://github.com/ieedan/implement/commit/14ce276cf1a03340930ae030410551d23efa724e)]:
  - @implementjs/core@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [[`c4cdbfd`](https://github.com/ieedan/implement/commit/c4cdbfd9590eda1e8df1ae1c3c241c98cd6b8b15)]:
  - @implementjs/core@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [[`aee1296`](https://github.com/ieedan/implement/commit/aee129639e5d4f04d3285c017c42fa3649fab48b)]:
  - @implementjs/core@0.0.2

## 0.0.1

### Patch Changes

- [`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed) Thanks [@ieedan](https://github.com/ieedan)! - initial setup
- Updated dependencies [[`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed), [`6629993`](https://github.com/ieedan/implement/commit/662999342363fb2bbdf37966bb0530c1d084f375), [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66)]:
  - @implementjs/core@0.0.1
