// @vitest-environment happy-dom
import { Div, Input, Option, Select } from "@implementjs/core";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { createForm, Field, Form, getInput, useField, validate } from "../src/index";
import { element, mount, tick } from "./utils";

const Schema = v.object({
	terms: v.boolean(),
	tags: v.array(v.string()),
	plan: v.string(),
	colors: v.array(v.string()),
	age: v.number(),
});

type SpecialForm = ReturnType<typeof createForm<typeof Schema>>;

function click(input: HTMLInputElement, checked: boolean) {
	input.checked = checked;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

function SpecialForm(form: SpecialForm) {
	return Form(
		{ of: form, onSubmit: vi.fn() },
		Field({ of: form, path: ["terms"] }, (field) =>
			Input({ ...field.props, type: "checkbox", checked: field.input }),
		),
		Field({ of: form, path: ["tags"], array: true }, (field) =>
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
		),
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
		),
		Field({ of: form, path: ["colors"] }, (field) =>
			Select(
				{ ...field.props, multiple: true },
				Option({ value: "red" }, "Red"),
				Option({ value: "blue" }, "Blue"),
			),
		),
		Field({ of: form, path: ["age"] }, (field) =>
			Input({
				...field.props,
				type: "number",
				value: field.input,
				// a number input reads back as a string, so the field is written by hand
				onInput: (event) => field.setInput(event.currentTarget.valueAsNumber),
			}),
		),
	);
}

describe("special inputs", () => {
	it("reads a single checkbox as a boolean", async () => {
		const form = createForm({ schema: Schema });
		const { target, unmount } = await mount(SpecialForm(form));

		click(element<HTMLInputElement>(target, "input[type=checkbox]", 0), true);
		await tick();
		expect(getInput(form, { path: ["terms"] })).toBe(true);

		click(element<HTMLInputElement>(target, "input[type=checkbox]", 0), false);
		await tick();
		expect(getInput(form, { path: ["terms"] })).toBe(false);
		unmount();
	});

	it("reads a checkbox group as a list of the checked values", async () => {
		const form = createForm({ schema: Schema });
		const { target, unmount } = await mount(SpecialForm(form));

		click(element<HTMLInputElement>(target, "input[type=checkbox]", 2), true);
		await tick();
		expect(getInput(form, { path: ["tags"] })).toEqual(["offers"]);

		click(element<HTMLInputElement>(target, "input[type=checkbox]", 1), true);
		await tick();
		expect(getInput(form, { path: ["tags"] })).toEqual(["news", "offers"]);
		unmount();
	});

	it("reads a radio group as the checked value", async () => {
		const form = createForm({ schema: Schema });
		const { target, unmount } = await mount(SpecialForm(form));

		click(element<HTMLInputElement>(target, "input[type=radio]", 1), true);
		await tick();
		expect(getInput(form, { path: ["plan"] })).toBe("pro");

		// the other radio reports its own unchecking, which must not clear the field
		click(element<HTMLInputElement>(target, "input[type=radio]", 0), false);
		await tick();
		expect(getInput(form, { path: ["plan"] })).toBe("pro");
		unmount();
	});

	it("reads a multi select as a list", async () => {
		const form = createForm({ schema: Schema });
		const { target, unmount } = await mount(SpecialForm(form));

		const select = element<HTMLSelectElement>(target, "select");
		select.options[0]!.selected = true;
		select.options[1]!.selected = true;
		select.dispatchEvent(new Event("input", { bubbles: true }));
		await tick();

		expect(getInput(form, { path: ["colors"] })).toEqual(["red", "blue"]);
		unmount();
	});

	it("takes a converted value from a handler of your own", async () => {
		const form = createForm({ schema: Schema });
		const { target, unmount } = await mount(SpecialForm(form));

		const age = element<HTMLInputElement>(target, "input[type=number]");
		age.value = "42";
		age.dispatchEvent(new Event("input", { bubbles: true }));
		await tick();

		expect(getInput(form, { path: ["age"] })).toBe(42);
		expect(useField(form, { path: ["age"] }).isDirty.get()).toBe(true);
		unmount();
	});

	it("validates an untouched checkbox as unchecked and an untouched group as empty", async () => {
		const form = createForm({ schema: Schema });
		const { unmount } = await mount(SpecialForm(form));

		await validate(form);

		// nothing was touched, yet what the user sees is a form of empty fields —
		// so a checkbox validates as `false` and a group as `[]`, not as missing
		expect(useField(form, { path: ["terms"] }).errors.get()).toBe(null);
		expect(useField(form, { path: ["tags"], array: true }).errors.get()).toBe(null);
		expect(useField(form, { path: ["colors"] }).errors.get()).toBe(null);
		// a number field has no empty value to stand in for, so it is still missing
		expect(useField(form, { path: ["age"] }).errors.get()).not.toBe(null);
		unmount();
	});
});
