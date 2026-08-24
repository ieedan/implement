---
title: API
description: Every export of @implementjs/formish, in one place.
section: Reference
order: 50
---

## Creating a form

### `createForm(config)`

| Option         | Type                                                                | Default          | What it does                                                 |
| -------------- | ------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| `schema`       | valibot schema with an object input                                 | required         | Types the fields, validates the input, produces the output   |
| `initialInput` | `DeepPartial<Input>`                                                | `{}`             | What the fields start at, over the schema's own empty values |
| `emptyInput`   | `EmptyInput`                                                        | `{ string: "" }` | Where a required field of a given type starts                |
| `validate`     | `"initial" \| "touch" \| "input" \| "change" \| "blur" \| "submit"` | `"submit"`       | When a field first reports errors                            |
| `revalidate`   | the same, without `"initial"`                                       | `"input"`        | When a field that already has errors reports again           |

Returns a **form store**:

| Property       | Type                         |
| -------------- | ---------------------------- |
| `input`        | `Readable<PartialValues>`    |
| `errors`       | `Readable<string[] \| null>` |
| `isSubmitting` | `Readable<boolean>`          |
| `isSubmitted`  | `Readable<boolean>`          |
| `isValidating` | `Readable<boolean>`          |
| `isTouched`    | `Readable<boolean>`          |
| `isEdited`     | `Readable<boolean>`          |
| `isDirty`      | `Readable<boolean>`          |
| `isValid`      | `Readable<boolean>`          |

`errors` is the form's own — issues the schema reported without a path. For the errors of the fields below it, use `getDeepErrors`.

## Components

### `Form(props, ...children)`

Takes every `<form>` prop except `onSubmit`, `noValidate` and `this`, plus:

| Prop       | Type                          | What it does                                           |
| ---------- | ----------------------------- | ------------------------------------------------------ |
| `of`       | `FormStore`                   | The form this element submits                          |
| `onSubmit` | `(output, event?) => unknown` | Runs with the schema's output once the input validates |

### `Field(props, render)`

`{ of, path }` plus a render callback that receives the field store. Returns what the callback renders.

### `FieldArray(props, render)`

`{ of, path }` plus a render callback that receives the field array store.

## Runes

### `useField(form, { path })`

| Property    | Type                                                            |
| ----------- | --------------------------------------------------------------- |
| `input`     | `Readable<T \| undefined>`                                      |
| `errors`    | `Readable<string[] \| null>`                                    |
| `error`     | `Readable<string \| null>`                                      |
| `isTouched` | `Readable<boolean>`                                             |
| `isEdited`  | `Readable<boolean>`                                             |
| `isDirty`   | `Readable<boolean>`                                             |
| `isValid`   | `Readable<boolean>`                                             |
| `name`      | `Readable<string>`                                              |
| `path`      | `Readable<Path>`                                                |
| `onInput`   | `(value) => void`                                               |
| `props`     | `{ name, autofocus, this, onFocus, onInput, onChange, onBlur }` |

`path` may be a readable, which is how a field follows an array item as it moves. Whether a field holds a list comes from the schema, so a checkbox group needs no hint.

### `useFieldArray(form, { path })`

Everything a field store has except `input`, `onInput` and `props`, plus:

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

Each takes the form store first. Every `path` is checked against the schema, and may be a readable. Leaving `path` out means the form as a whole.

### Input

| Method                             | What it does                                                  |
| ---------------------------------- | ------------------------------------------------------------- |
| `getInput(form, { path? })`        | Reads a field, or the whole input, once                       |
| `setInput(form, { path?, input })` | Writes it, marking the field touched and edited               |
| `getDirtyInput(form, { path? })`   | Only the parts that changed; arrays are reported whole        |
| `getDirtyPaths(form, { path? })`   | The paths of the fields that changed                          |
| `pickDirty(form, { from })`        | The dirty parts of a value of your own, read through the form |

### Errors

| Method                                 | What it does                                               |
| -------------------------------------- | ---------------------------------------------------------- |
| `getErrors(form, { path? })`           | A field's own errors, or the form's                        |
| `getDeepErrors(form, { path? })`       | Every message at or below it, as one list                  |
| `getDeepError(form, { path? })`        | The first of them                                          |
| `getDeepErrorEntry(form, { path? })`   | That first one with the path it came from                  |
| `getDeepErrorEntries(form, { path? })` | Every message paired with its path                         |
| `setErrors(form, { path?, errors })`   | Reports errors the schema cannot know about; `null` clears |

### State

| Method                       | What it does                                             |
| ---------------------------- | -------------------------------------------------------- |
| `isTouched(form, { path? })` | Whether it, or anything below it, was focused or written |
| `isEdited(form, { path? })`  | Whether its value was changed                            |
| `isDirty(form, { path? })`   | Whether it differs from what it started at               |
| `isValid(form, { path? })`   | Whether the last validation left it clean                |

### Validation and submission

| Method                             | What it does                                                           |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `validate(form, { shouldFocus? })` | Runs the schema now; resolves with the result                          |
| `focus(form, { path })`            | Focuses the first of the field's elements that can take it             |
| `submit(form)`                     | Submits the mounted form element, running `Form`'s own handler         |
| `handleSubmit(form, handler)`      | The submit handler `Form` installs, for a `<form>` you render yourself |

### Reset

`reset(form, config?)` puts a field — or the whole form — back to what it started at.

| Option          | What it does                                                |
| --------------- | ----------------------------------------------------------- |
| `path`          | The field to reset. Leave it out for the whole form         |
| `initialInput`  | A new starting point, which later resets go back to as well |
| `keepInput`     | Leave the values as they are                                |
| `keepTouched`   | Leave the touched state                                     |
| `keepEdited`    | Leave the edited state                                      |
| `keepErrors`    | Leave the errors                                            |
| `keepSubmitted` | Leave the submitted state (the whole form only)             |

### Array methods

| Method                                       | What it does                                  |
| -------------------------------------------- | --------------------------------------------- |
| `insert(form, { path, at?, initialInput? })` | Inserts an array item, appending without `at` |
| `remove(form, { path, at })`                 | Removes one                                   |
| `move(form, { path, from, to })`             | Moves one                                     |
| `swap(form, { path, at, and })`              | Swaps two                                     |
| `replace(form, { path, at, initialInput? })` | Replaces one, dropping the old item's state   |

An index that is not in the list leaves the list alone.

## Types

`FormSchema`, `Schema`, `FormConfig`, `FormStore`, `BaseFormStore`, `FieldStore`, `FieldArrayStore`, `FieldPath`, `ArrayPath`, `DirtyPath`, `PathValue`, `Path`, `PathKey`, `RequiredPath`, `ExactKeysOf`, `PropertiesOf`, `FieldErrors`, `FieldElement`, `FieldElementProps`, `ValidationMode`, `RevalidationMode`, `DeepPartial`, `PartialValues`, `PartialInput`, `MaybeReadable`, `MaybePromise`, `SubmitHandler`, `SubmitEventHandler`, `SubmitLikeEvent`, `DeepErrorEntry`, `EmptyInput`, `InferInput`, `InferOutput`, and the internal store types `InternalFormStore`, `InternalFieldStore`, `InternalArrayStore`, `InternalObjectStore`, `InternalValueStore`.

The value `DEFAULT_EMPTY_INPUT` is exported too, for building an `emptyInput` on top of the default, along with the `INTERNAL` symbol the internal store hangs off.
