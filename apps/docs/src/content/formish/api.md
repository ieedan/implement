---
title: API
description: Every export of @implementjs/formish, in one place.
section: Reference
order: 50
---

## Creating a form

### `createForm(config)`

| Option         | Type                                                                | Default    | What it does                                               |
| -------------- | ------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `schema`       | Standard Schema with an object input                                | required   | Types the fields, validates the input, produces the output |
| `initialInput` | `DeepPartial<Input>`                                                | `{}`       | What the fields start at                                   |
| `validate`     | `"initial" \| "touch" \| "input" \| "change" \| "blur" \| "submit"` | `"submit"` | When a field first reports errors                          |
| `revalidate`   | the same, without `"initial"`                                       | `"input"`  | When a field that already has errors reports again         |

Returns a **form store**:

| Property       | Type                         |
| -------------- | ---------------------------- |
| `input`        | `Readable<PartialInput>`     |
| `errors`       | `Readable<string[] \| null>` |
| `isSubmitting` | `Readable<boolean>`          |
| `isSubmitted`  | `Readable<boolean>`          |
| `isValidating` | `Readable<boolean>`          |
| `isTouched`    | `Readable<boolean>`          |
| `isEdited`     | `Readable<boolean>`          |
| `isDirty`      | `Readable<boolean>`          |
| `isValid`      | `Readable<boolean>`          |

## Components

### `Form(props, ...children)`

Takes every `<form>` prop except `onSubmit` and `noValidate`, plus:

| Prop       | Type                          | What it does                                           |
| ---------- | ----------------------------- | ------------------------------------------------------ |
| `of`       | `FormStore`                   | The form this element submits                          |
| `onSubmit` | `(output, event?) => unknown` | Runs with the schema's output once the input validates |

### `Field(props, render)`

`{ of, path, array? }` plus a render callback that receives the field store. Returns what the callback renders.

### `FieldArray(props, render)`

`{ of, path }` plus a render callback that receives the field array store.

## Runes

### `useField(form, { path, array? })`

| Property    | Type                                           |
| ----------- | ---------------------------------------------- |
| `input`     | `Readable<T \| undefined>`                     |
| `errors`    | `Readable<string[] \| null>`                   |
| `error`     | `Readable<string \| null>`                     |
| `isTouched` | `Readable<boolean>`                            |
| `isEdited`  | `Readable<boolean>`                            |
| `isDirty`   | `Readable<boolean>`                            |
| `isValid`   | `Readable<boolean>`                            |
| `name`      | `Readable<string>`                             |
| `path`      | `Readable<Path>`                               |
| `setInput`  | `(value) => void`                              |
| `props`     | `{ name, onFocus, onInput, onChange, onBlur }` |

`path` may be a readable, which is how a field follows an array item as it moves. `array: true` marks a field as holding a list when neither its value nor its element says so — a checkbox group, in practice.

### `useFieldArray(form, { path })`

Everything a field store has except `input`, `setInput` and `props`, plus:

| Property   | Type                                 | What it is                                     |
| ---------- | ------------------------------------ | ---------------------------------------------- |
| `items`    | `Readable<string[]>`                 | One id per item, in order                      |
| `itemPath` | `(index, ...rest) => Readable<Path>` | The path of a field inside the item at `index` |
| `insert`   | `({ at?, initialInput? }) => void`   |                                                |
| `remove`   | `({ at }) => void`                   |                                                |
| `move`     | `({ from, to }) => void`             |                                                |
| `swap`     | `({ at, and }) => void`              |                                                |
| `replace`  | `({ at, initialInput? }) => void`    |                                                |

## Methods

Each takes the form store first. Every `path` is checked against the schema.

| Method                                       | What it does                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `getInput(form, { path? })`                  | Reads a field, or the whole input, once                                |
| `setInput(form, { path?, input })`           | Writes it, marking the field touched and edited                        |
| `getErrors(form, { path? })`                 | A field's errors, or the form's own                                    |
| `getAllErrors(form)`                         | Every error in the form, with the path that reported it                |
| `setErrors(form, { path?, errors })`         | Reports errors the schema cannot know about                            |
| `clearErrors(form, { path? })`               | Drops the errors of a subtree, or of the whole form                    |
| `validate(form, { shouldFocus? })`           | Runs the schema now; resolves with the result                          |
| `reset(form, { path?, initialInput? })`      | Back to the starting point, dropping errors and state                  |
| `focus(form, { path })`                      | Focuses the field's element                                            |
| `submit(form)`                               | Submits the form element, running `Form`'s own handler                 |
| `handleSubmit(form, handler)`                | The submit handler `Form` installs, for a `<form>` you render yourself |
| `insert(form, { path, at?, initialInput? })` | Inserts an array item                                                  |
| `remove(form, { path, at })`                 | Removes one                                                            |
| `move(form, { path, from, to })`             | Moves one                                                              |
| `swap(form, { path, at, and })`              | Swaps two                                                              |
| `replace(form, { path, at, initialInput? })` | Replaces one, dropping the old item's state                            |

## Types

`FormSchema`, `FormConfig`, `FormStore`, `FieldStore`, `FieldArrayStore`, `FieldPath`, `ArrayPath`, `PathValue`, `Path`, `PathKey`, `FieldErrors`, `FieldElement`, `FieldElementProps`, `ValidationMode`, `RevalidationMode`, `DeepPartial`, `PartialInput`, `SubmitHandler`, and the Standard Schema types `StandardSchemaV1`, `InferInput`, `InferOutput`.
