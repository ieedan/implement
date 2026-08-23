---
title: Validation
description: When a form validates, what it validates, and errors that come from elsewhere.
section: Guides
order: 20
---

The schema is the only description of what valid means. Formish runs it over the whole input, then hands each issue to the field its path points at.

```ts
const SignUpSchema = v.object({
	email: v.pipe(v.string(), v.minLength(1, "Enter your email"), v.email("Enter a valid email")),
	password: v.pipe(v.string(), v.minLength(8, "At least 8 characters")),
});
```

An issue with no path — a check across two fields — becomes an error of the form itself, on `form.errors`.

## When it runs

```ts
createForm({ schema, validate: "blur", revalidate: "input" });
```

`validate` is when a field first reports anything; `revalidate` takes over for a field that already has an error (and for every field once the form has been submitted). The default pair is `submit` and `input`: quiet until the first submit, then correcting as you type — which is the behaviour most forms want.

| Mode      | Validates                            |
| --------- | ------------------------------------ |
| `initial` | Once, as soon as the form is created |
| `touch`   | When a field is focused              |
| `input`   | On every keystroke                   |
| `change`  | On the element's `change` event      |
| `blur`    | When a field loses focus             |
| `submit`  | On submit only (`validate` default)  |

`revalidate` takes the same values except `initial`.

Validation runs over the whole form, so one field's blur reports every field's errors — including ones the user has not reached yet. That is usually what you want after a submit, and often too eager before one. To hold a message back until the field has been visited, gate it on `isTouched`:

```ts
const message = derived([field.errors, field.isTouched], (errors, touched) =>
	touched ? (errors?.[0] ?? null) : null,
);

If(message).Then(FieldError(message));
```

## Where fields start

A field nobody has typed into holds nothing, which would make a required string fail as "expected string, received undefined" rather than with your own message. So formish walks the schema when the form is created and gives every field a starting value: `""` for a string, `false` for a boolean, `[]` for an array, `null` for a nullable. Write your messages for the empty case and they are what the user gets:

```ts
v.pipe(v.string(), v.minLength(1, "Enter your email"));
```

This comes from the schema, not from the DOM, so it does not depend on what is currently rendered. A field behind a collapsed section, on a tab nobody has opened, or with no `Field` written for it at all validates exactly like one that is on screen.

A field with no empty value to stand in for — a number, a date — stays missing, and the schema reports it as such. Name one per type to change that:

```ts
createForm({
	schema: SignUpSchema,
	emptyInput: {
		number: 0, // required numbers start at 0 instead of missing
		string: undefined, // opt a type out entirely
	},
});
```

`emptyInput` is merged over the defaults (`{ string: "", boolean: false }`), so naming `number` leaves the other two in place. Optional fields are never affected — they accept a missing value already.

> [!NOTE]
> Formish walks objects, arrays, tuples, intersections and the optional/nullable wrappers. It does not walk into a `v.union`, a `v.variant` or a `v.record`, since there is no single branch or key set to seed from; those fields hold whatever `initialInput` gives them.

## Validating by hand

`validate` runs the schema whatever the mode says, and resolves with the result:

```ts
const result = await validate(form);
if (!result.issues) console.log(result.value);
```

Pass `{ shouldFocus: true }` to move focus to the first field with an error, the way submitting does.

## Async schemas

An async schema — a uniqueness check against a server, say — works the same, and `form.isValidating` is true while it runs:

```ts
const SignUpSchema = v.objectAsync({
	username: v.pipeAsync(
		v.string(),
		v.checkAsync(async (name) => !(await api.isTaken(name)), "Already taken"),
	),
});

Span(
	{ class: "hint" },
	form.isValidating.bind((busy) => (busy ? "Checking…" : "")),
);
```

Only the newest validation may write, so a slow check that settles after a newer one cannot bring back errors the user has already fixed.

## Submitting

`Form`'s `onSubmit` runs only if validation passed, and receives the schema's **output** — after every transform in it:

```ts
const Schema = v.object({
	age: v.pipe(v.string(), v.transform(Number), v.number()),
});

Form({ of: form, onSubmit: (output) => save(output) }, AgeField());
// output.age is a number, even though the field held a string
```

While the handler runs, `form.isSubmitting` is true — bind it to the button's `disabled`. If the handler throws, the message lands on `form.errors` instead of escaping, so a failed request can be rendered like any other error:

```ts
Span(
	{ class: "error" },
	form.errors.bind((errors) => errors?.[0] ?? ""),
);
```

Rendering the `<form>` element yourself instead of using `Form`? `handleSubmit` is the same wrapper:

```ts
FormElement({ noValidate: true, onSubmit: handleSubmit(form, onSubmit) }, AgeField());
```

And `submit(form)` submits from anywhere — a button outside the form, a keyboard shortcut.

## Errors from the server

`setErrors` reports what a schema cannot know:

```ts
const result = await api.signUp(output);
if (result.error === "email-taken") {
	setErrors(form, { path: ["email"], errors: "That email is already registered" });
}
```

They behave like any other error — the field is invalid, `form.isValid` is false — and the next validation replaces them. `clearErrors(form, { path: ["email"] })` drops them early; without a path it clears the whole form.

`getErrors(form, { path })` reads one field's errors once, and `getAllErrors(form)` returns every error in the form with the path that reported it, which is handy for an error summary at the top of a long form.
