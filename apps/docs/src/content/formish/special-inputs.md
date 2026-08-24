---
title: Special inputs
description: Checkboxes, radios, selects, files, and values the DOM cannot express.
section: Guides
order: 40
---

`field.props` fits every native form control. What changes between them is the value binding and, for a few, what the field ends up holding.

## Checkbox

A single checkbox is a boolean, bound with `checked`:

```ts
const Schema = v.object({ terms: v.literal(true, "Accept the terms to continue") });

Field({ of: form, path: ["terms"] }, (field) =>
	Input({ ...field.props, type: "checkbox", checked: field.input }),
);
```

## Checkbox group

Several checkboxes sharing one field make a list of the checked values. They share it by sharing `field.props` — the `name` is what groups them:

```ts
const Schema = v.object({ tags: v.array(v.string()) });

Field({ of: form, path: ["tags"] }, (field) =>
	Div(
		...["news", "offers"].map((value) =>
			Input({
				...field.props,
				type: "checkbox",
				value,
				checked: field.input.bind((tags) => tags?.includes(value) ?? false),
			}),
		),
	),
);
```

Nothing marks the group as a group: the schema already says the field holds a list, so a `v.array(...)` field reads every box under its `name` and a `v.string()` field reads a single `checked`. A misconfigured element cannot change that — the schema decides the shape, not the DOM.

## Radio group

Radios share a field the same way, and the field holds the checked value:

```ts
Field({ of: form, path: ["plan"] }, (field) =>
	Div(
		...["free", "pro"].map((value) =>
			Input({
				...field.props,
				type: "radio",
				value,
				checked: field.input.bind((plan) => plan === value),
			}),
		),
	),
);
```

An unchecked radio reporting itself does not clear the field — the checked one in the group is what speaks for it.

## Select

A single select binds `value` like a text input:

```ts
Field({ of: form, path: ["country"] }, (field) =>
	Select({ ...field.props, value: field.input }, ...options),
);
```

A `multiple` select holds the list of selected values, because the schema says the field is an array:

```ts
Field({ of: form, path: ["colors"] }, (field) =>
	Select({ ...field.props, multiple: true }, ...options),
);
```

## File input

A file input holds a `File`, or a list of them when it is `multiple`:

```ts
const Schema = v.object({ avatar: v.instance(File, "Choose an image") });

Field({ of: form, path: ["avatar"] }, (field) =>
	Input({ ...field.props, type: "file", accept: "image/*" }),
);
```

There is no value binding: a file input's selection cannot be written from script, so nothing drives it the other way. `reset` clears the element as well as the field, which is the one case where formish touches the DOM itself.

## Numbers, dates, and anything converted

The DOM reads back strings. A field typed as a number or a date needs a handler that converts before storing:

```ts
Input({
	...field.props,
	type: "number",
	value: field.input,
	onInput: (event) => field.onInput(event.currentTarget.valueAsNumber),
});
```

```ts
Input({
	...field.props,
	type: "date",
	onInput: (event) => field.onInput(event.currentTarget.valueAsDate ?? undefined),
});
```

Spread `field.props` first so your handler replaces the one it carries.

The other way around is to let the schema convert, which keeps the field a string and moves the conversion into the output:

```ts
const Schema = v.object({
	age: v.pipe(v.string(), v.transform(Number), v.number("Enter a number")),
});
```

Then `field.input` is the string the input holds, and `onSubmit` receives a number.

## A component of your own

Anything that reports a value can be a field — a slider, a rich text editor, a [primitive](/primitives):

```ts
const rating = useField(form, { path: ["rating"] });

RatingGroup({
	value: rating.input.bind((value) => value ?? 0),
	onValueChange: (value) => rating.onInput(value),
});
```

`field.props` is for native elements; a component that has no `name` and fires no DOM events only needs `onInput`.
