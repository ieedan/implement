import { Div, ForEach, If, signal, type Readable } from "@implementjs/core";
import { createForm, Form, useField, useFieldArray } from "@implementjs/formish";
import * as v from "valibot";
import { Button } from "@/lib/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/lib/components/ui/field";
import { Input } from "@/lib/components/ui/input";

const ShoppingListSchema = v.object({
	items: v.pipe(
		v.array(
			v.object({
				label: v.pipe(v.string(), v.minLength(1, "Every item needs a name")),
			}),
		),
		v.minLength(1, "Add at least one item"),
	),
});

export default function FieldArrayDemo() {
	const form = createForm({
		schema: ShoppingListSchema,
		initialInput: { items: [{ label: "Coffee" }, { label: "Oat milk" }] },
	});
	const items = useFieldArray(form, { path: ["items"] });
	const saved = signal("");

	// one row: the path is a readable, so a row that moves follows its item
	function ItemField(_id: Readable<string>, index: Readable<number>) {
		const field = useField(form, { path: items.itemPath(index, "label") });
		// set only while the field has an error: `data-invalid` styles the field,
		// `aria-invalid` announces it
		const invalid = field.errors.bind((errors) => (errors ? "true" : undefined));

		return Field(
			{ "data-invalid": invalid },
			FieldLabel({ class: "sr-only", for: field.name }, "Item"),
			Div(
				{ class: "flex items-center gap-2" },
				Input({ ...field.props, id: field.name, value: field.input, "aria-invalid": invalid }),
				Button(
					{
						variant: "outline",
						size: "icon",
						"aria-label": "Move up",
						disabled: index.bind((current) => current === 0),
						onClick: () => items.move({ from: index.get(), to: index.get() - 1 }),
					},
					"↑",
				),
				Button(
					{
						variant: "outline",
						size: "icon",
						"aria-label": "Remove",
						onClick: () => items.remove({ at: index.get() }),
					},
					"✕",
				),
			),
			If(field.error).Then(FieldError(field.error)),
		);
	}

	return Form(
		{
			of: form,
			onSubmit: (output) => saved.set(output.items.map((item) => item.label).join(", ")),
			class: "w-full max-w-sm",
		},
		FieldSet(
			FieldLegend({ variant: "label" }, "Shopping list"),
			FieldGroup(
				{ class: "gap-4" },
				ForEach(items.items, (id) => id, ItemField),
				If(items.error).Then(FieldError(items.error)),
				Div(
					{ class: "flex items-center gap-2" },
					Button(
						{ variant: "outline", onClick: () => items.insert({ initialInput: { label: "" } }) },
						"Add item",
					),
					Button({ type: "submit" }, "Save"),
				),
				If(saved).Then(FieldDescription(saved.bind((list) => `Saved: ${list}`))),
			),
		),
	);
}
