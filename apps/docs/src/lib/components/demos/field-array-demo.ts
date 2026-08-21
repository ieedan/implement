import { Div, ForEach, Input, P, Span, signal } from "@implementjs/core";
import { createForm, Field, Form, useFieldArray } from "@implementjs/formish";
import * as v from "valibot";
import { Button } from "@/lib/components/ui/button";

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

const inputClass =
	"h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function FieldArrayDemo() {
	const form = createForm({
		schema: ShoppingListSchema,
		initialInput: { items: [{ label: "Coffee" }, { label: "Oat milk" }] },
	});
	const items = useFieldArray(form, { path: ["items"] });
	const saved = signal("");

	return Form(
		{
			of: form,
			onSubmit: (output) => saved.set(output.items.map((item) => item.label).join(", ")),
			class: "flex w-full max-w-sm flex-col gap-3",
		},
		Div(
			{ class: "flex flex-col gap-2" },
			ForEach(
				items.items,
				(id) => id,
				// the row's path is a readable, so a row that moves follows its item
				(_id, index) =>
					Field({ of: form, path: items.itemPath(index, "label") }, (field) =>
						Div(
							{ class: "flex flex-col gap-1" },
							Div(
								{ class: "flex items-center gap-2" },
								Input({ ...field.props, class: inputClass, value: field.input }),
								Button(
									{
										variant: "outline",
										size: "icon-sm",
										"aria-label": "Move up",
										disabled: index.bind((current) => current === 0),
										onClick: () => items.move({ from: index.get(), to: index.get() - 1 }),
									},
									"↑",
								),
								Button(
									{
										variant: "outline",
										size: "icon-sm",
										"aria-label": "Remove",
										onClick: () => items.remove({ at: index.get() }),
									},
									"✕",
								),
							),
							Span({ class: "min-h-4 text-xs text-destructive" }, field.error),
						),
					),
			),
			// the list's own error, from the `minLength` around the array
			Span({ class: "min-h-4 text-xs text-destructive" }, items.error),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Button(
				{ variant: "outline", onClick: () => items.insert({ initialInput: { label: "" } }) },
				"Add item",
			),
			Button({ type: "submit" }, "Save"),
		),
		P({ class: "min-h-5 text-sm text-muted-foreground" }, saved),
	);
}
