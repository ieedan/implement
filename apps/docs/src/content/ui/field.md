---
title: Field
description: A control, its label, its hint, and its error.
section: Components
---

<div data-demo="field" data-demo-description="A “Report a bug” fieldset: a title input with a hint, a steps textarea in an error state, a separator with the word “and” on it, and a horizontal checkbox row."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/field
```

jsrepo pulls [`label`](/ui/label) and [`separator`](/ui/separator) along with it, and installs `tailwind-variants`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/field.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and [`label`](/ui/label) and [`separator`](/ui/separator) from the same directory — copy those in beside it too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants
```

<div data-source="field"></div>

<div data-tabs-end></div>

## Usage

A field is the unit a form is actually made of. `Field` groups one control with everything that describes it; `FieldGroup` is the column they sit in; `FieldSet` and `FieldLegend` name a section.

```ts
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@/lib/components/ui/field";

FieldSet(
	FieldLegend("Report a bug"),
	FieldGroup(
		Field(
			FieldLabel({ for: "title" }, "Title"),
			Input({ id: "title" }),
			FieldDescription("One line describing what went wrong."),
		),
	),
);
```

## Errors

Two things mark an error, and they do different jobs: `aria-invalid` on the control is what gets announced, and `data-invalid="true"` on the field is what turns the label and the text destructive.

```ts
Field(
	{ "data-invalid": "true" },
	FieldLabel({ for: "steps" }, "Steps to reproduce"),
	Textarea({ id: "steps", "aria-invalid": true }),
	FieldError("Tell us how to reproduce it before submitting."),
);
```

`FieldError` carries `role="alert"`, so the message is read when it appears. Rendering nothing at all when there is no error — rather than an empty element — keeps the layout from jumping.

## Orientation

`vertical` puts the label above the control. `horizontal` puts it beside, which is the shape for a checkbox or a switch row — pair it with `FieldContent` so the title and description stack next to the control:

```ts
Field(
	{ orientation: "horizontal" },
	Checkbox({ id: "subscribe" }),
	FieldContent(
		FieldTitle("Email me about this"),
		FieldDescription("Only when the status changes."),
	),
);
```

`responsive` is the third: vertical until the form is wide enough, then horizontal. It measures `FieldGroup`, which is a container — so it responds to how wide the form is, not how wide the window is. A form in a narrow sidebar stays stacked even on a large screen.

## Separators

`FieldSeparator()` is a plain rule. Pass children and the word sits on the line, which is how an "or" divider between a form and a social sign-in is built.

## API Reference

<div data-api="ui-field"></div>
