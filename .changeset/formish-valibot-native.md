---
"@implementjs/formish": patch
---

Build the form input from the valibot schema instead of the DOM

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
