---
"@implementjs/formish": patch
---

Port formish to Formisch proper, rather than modelling its API

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
