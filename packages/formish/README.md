[![npm version](https://img.shields.io/npm/v/@implementjs/formish.svg)](https://www.npmjs.com/package/@implementjs/formish) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/formish.svg)](https://www.npmjs.com/package/@implementjs/formish)

# @implementjs/formish

Schema-first forms for [implement](https://github.com/ieedan/implement). The schema types
the fields, validates the input and produces the output your submit handler receives.
Schemas are [valibot](https://valibot.dev), and formish reads them: it walks the schema
when the form is created and gives every field a starting value, so a field validates
whether or not you ever render one for it.

```sh
npm install @implementjs/formish valibot
```

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
				Label({ htmlFor: "email" }, "Email"),
				Input({ ...field.props, id: "email", type: "email", value: field.input }),
				Span(field.error),
			),
		),
		Button({ type: "submit", disabled: form.isSubmitting }, "Sign up"),
	);
}
```

`field.props` carries the name and the event handlers; the value binding stays yours, so a
checkbox binds `checked` and a text input binds `value`. Everything a field exposes —
`input`, `error`, `isDirty`, `isTouched` — is a readable, so it binds straight into the DOM
and updates on its own.

Fields are addressed by path (`["todos", 0, "label"]`), which is what makes them typed
against the schema without a second set of type definitions. Array fields render by item
id, so a row keeps its state when the list is reordered.

Because the schema — not the DOM — says which fields exist, `input` holds the whole shape
before anything mounts (`{ email: "", password: "" }` above). A field you forget to render
is a field the schema still validates, with its own message, rather than a form that
quietly refuses to submit. Where a required field starts is configurable per type with
`emptyInput`, which defaults to `{ string: "", boolean: false }`.

Full documentation: [/formish](https://github.com/ieedan/implement/tree/main/apps/docs/src/content/formish)

## Credits

The API is modeled on [Formisch](https://formisch.dev) by Fabian Hiller (MIT), which does
the same job for React, Solid, Vue, Svelte and friends. This is an implement-native take on
it: implement signals instead of framework adapters.
