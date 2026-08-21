---
title: Introduction
description: Schema-first forms for implement — typed fields, validation, and field arrays.
section: Start Here
order: 1
---

`@implementjs/formish` manages what a form holds and what is wrong with it. You write a schema, the schema types the fields, validates the input and produces the value your submit handler receives. Formish owns none of the markup: you render the inputs, it hands you the state to bind.

<div data-demo="sign-up-form" data-demo-description="A sign up form with an email and a password field. Leaving a field invalid and blurring it shows the schema's message underneath; submitting with valid input reports the email that signed up."></div>

Every schema library that implements [Standard Schema](https://standardschema.dev) works — [valibot](https://valibot.dev), [zod](https://zod.dev), [arktype](https://arktype.io) — and formish depends on none of them. These docs use valibot.

> [!NOTE]
> The API is modeled on [Formisch](https://formisch.dev) by Fabian Hiller, which does the same job for React, Solid, Vue and Svelte. If you have used it, you already know this library; the differences are that state arrives as [readables](/docs/signals) instead of framework reactivity, and the schema is any Standard Schema rather than valibot specifically.

## Installation

```sh
npm install @implementjs/formish valibot
```

A new app can start with it already wired up:

```sh
npm create implement-app@latest my-app -- --forms
```

## A form in three pieces

```ts
import { Button, Div, Input, Label, Span } from "@implementjs/core";
import { createForm, Field, Form } from "@implementjs/formish";
import * as v from "valibot";

const SignUpSchema = v.object({
	email: v.pipe(v.string(), v.email("Enter a valid email")),
	password: v.pipe(v.string(), v.minLength(8, "At least 8 characters")),
});

export function SignUp() {
	const form = createForm({ schema: SignUpSchema });

	return Form(
		{ of: form, onSubmit: (output) => api.signUp(output) },
		Field({ of: form, path: ["email"] }, (field) =>
			Div(
				Label({ for: "email" }, "Email"),
				Input({ ...field.props, id: "email", type: "email", value: field.input }),
				Span(field.error),
			),
		),
		Button({ type: "submit", disabled: form.isSubmitting }, "Sign up"),
	);
}
```

**`createForm`** builds the store. It holds the input, the errors, and whether the form is submitting, submitted, touched, edited, dirty or valid — all as readables.

**`Form`** renders the `<form>` element. It turns off the browser's own validation, validates on submit, focuses the first field with an error, and only then calls `onSubmit` — with the schema's _output_, so a transform in the schema has already run.

**`Field`** looks a field up by path and renders it. `field.props` carries the name and the event handlers; the value binding stays yours, because only you know whether this element wants `value` or `checked`.

The markup above is plain elements, so it works in any app. The demos on these pages use the [`Field`](/ui/field) components from [`@implementjs/ui`](/ui) instead — same state, styled — which [Fields](/formish/fields#with-implementjsui) shows how to wire up.

## Why paths

A field is addressed by a path — `["email"]`, `["todos", 0, "label"]` — rather than a string name. The path is checked against the schema, so a typo is a type error and autocompletion knows what comes next:

```ts
useField(form, { path: ["profile", "nickname"] }); // Readable<string | undefined>
useField(form, { path: ["profile", "nickmame"] }); // type error
```

The same path is what the store keys state on and what the element's `name` attribute becomes (`profile.nickname`), which is how a radio or checkbox group ties its elements together.

## Where to go next

- [Fields](/formish/fields) — binding elements, field state, and doing it without the `Field` component
- [Validation](/formish/validation) — when a form validates, async schemas, and errors from a server
- [Field arrays](/formish/field-arrays) — lists that can be added to, reordered and removed from
- [Special inputs](/formish/special-inputs) — checkboxes, radios, selects, files, numbers and dates
- [API](/formish/api) — every export, in one table
