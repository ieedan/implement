---
title: Fields
description: Binding elements to fields, and what a field knows about itself.
section: Guides
order: 10
---

A field is one path into the form input. `useField` looks it up:

```ts
import { useField } from "@implementjs/formish";

const email = useField(form, { path: ["email"] });
```

Everything it reports is a [readable](/docs/signals), so it binds straight into the DOM and updates on its own:

| Property    | Type                         | What it is                                                 |
| ----------- | ---------------------------- | ---------------------------------------------------------- |
| `input`     | `Readable<T \| undefined>`   | What the field holds, typed by the schema                  |
| `errors`    | `Readable<string[] \| null>` | Every message the last validation reported for it          |
| `error`     | `Readable<string \| null>`   | The first of them, which is what a field usually shows     |
| `isTouched` | `Readable<boolean>`          | Focused or written to                                      |
| `isEdited`  | `Readable<boolean>`          | Changed at least once, even if it is back where it started |
| `isDirty`   | `Readable<boolean>`          | Differs from what it started at                            |
| `isValid`   | `Readable<boolean>`          | Nothing in it or below it has errors                       |
| `name`      | `Readable<string>`           | The dotted path, which is also the element's `name`        |
| `path`      | `Readable<Path>`             | The path itself                                            |

Plus `setInput(value)` to write it by hand, and `props` to spread onto the element.

## Binding an element

`field.props` is deliberately small: the `name` and the four handlers that keep the store in step with the element.

```ts
Input({ ...field.props, type: "email", value: field.input });
```

The value binding is separate because the element decides what it is called. A text input binds `value`, a checkbox binds `checked`:

```ts
Input({ ...field.props, type: "checkbox", checked: field.input });
```

Bind it in that direction — `field.input` is a readable, so it drives the element and the handlers drive the store. That is what makes `setInput`, `reset` and a loaded record all show up on screen.

> [!NOTE]
> Do not pass a writable signal to `value` as well. implement two-way binds `value` to a writable, which would leave two things writing the element.

## The Field component

`Field` is `useField` with the markup that reads it kept alongside the path:

```ts
Field({ of: form, path: ["email"] }, (field) =>
	Div(
		Label({ for: "email" }, "Email"),
		Input({ ...field.props, id: "email", type: "email", value: field.input }),
		Span({ class: "error" }, field.error),
	),
);
```

The callback runs once, like every implement component — nothing re-renders, the readables update the nodes they are bound to. Use `useField` directly when the field is read somewhere other than where it is rendered, such as a submit button that watches one field.

## Showing errors

`field.error` is `null` until validation has something to say, and `Span(field.error)` renders nothing for `null`. To show a container only when there is an error, use [`If`](/docs/if):

```ts
If(field.error).Then(() => P({ class: "error" }, field.error));
```

Fields are quiet by default: nothing is reported until the first submit. See [Validation](/formish/validation) for the other modes.

## Nested fields

An object in the schema is a field too. Its state rolls up from everything inside it:

```ts
const address = useField(form, { path: ["address"] });

address.isDirty; // true when any of its fields changed
address.isValid; // false when any of them has an error
address.input; // Readable<{ city?: string; zip?: string } | undefined>
```

Writing one writes the whole subtree:

```ts
setInput(form, { path: ["address"], input: { city: "Paris", zip: "75001" } });
```

## Writing a field by hand

`field.setInput(value)` is the same write the input handler does — it marks the field touched and edited and revalidates if the mode calls for it. Reach for it when the value cannot come off the DOM as-is, or when a component of your own reports the change:

```ts
Input({
	...field.props,
	type: "number",
	value: field.input,
	// a number input reads back as a string, so convert before storing
	onInput: (event) => field.setInput(event.currentTarget.valueAsNumber),
});
```

Spread `field.props` first so your handler replaces the one it carries. [Special inputs](/formish/special-inputs) covers the rest of these cases.

## Reading the form

The form store carries the same kind of state for the form as a whole:

```ts
form.input; // Readable — everything the fields hold
form.errors; // Readable — the schema's issues about the form itself, not a field
form.isSubmitting; // Readable<boolean> — while the submit handler runs
form.isSubmitted; // Readable<boolean> — after the first submit attempt
form.isValidating; // Readable<boolean> — while an async schema runs
form.isTouched; // Readable<boolean> — any field focused or written to
form.isEdited; // Readable<boolean> — any field changed
form.isDirty; // Readable<boolean> — any field differs from where it started
form.isValid; // Readable<boolean> — the last validation found nothing
```

`getInput(form)` reads the input once, outside any binding, which is what you want in an event handler:

```ts
Button({ onClick: () => console.log(getInput(form, { path: ["email"] })) }, "Log");
```

## Resetting

`reset` puts a field — or the whole form — back to what it started at, dropping errors and touched state with it:

```ts
reset(form); // the whole form
reset(form, { path: ["address"] }); // one subtree
reset(form, { initialInput: loadedRecord }); // a new starting point, which later resets go back to
```

That last form is how you load a record into an already-rendered form: the fields fill in and nothing reports itself dirty.
