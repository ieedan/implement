// @vitest-environment happy-dom
import { Div, Input } from "@implementjs/core";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import {
	clearErrors,
	createForm,
	Field,
	Form,
	getAllErrors,
	getErrors,
	handleSubmit,
	setInput,
	submit,
	useField,
	validate,
	type ValidationMode,
} from "../src/index";
import { element, mount, tick } from "./utils";

const ProfileSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Enter a name")),
	address: v.object({
		city: v.pipe(v.string(), v.minLength(1, "Enter a city")),
	}),
});

function ProfileForm(
	form: ReturnType<typeof createForm<typeof ProfileSchema>>,
	onSubmit = vi.fn(),
) {
	return Form(
		{ of: form, onSubmit },
		Field({ of: form, path: ["name"] }, (field) => Input({ ...field.props, value: field.input })),
		Field({ of: form, path: ["address", "city"] }, (field) =>
			Input({ ...field.props, value: field.input }),
		),
	);
}

async function mountWithMode(validateMode: ValidationMode) {
	const form = createForm({ schema: ProfileSchema, validate: validateMode });
	const mounted = await mount(ProfileForm(form));
	return { form, ...mounted };
}

describe("validation modes", () => {
	it("validates on touch", async () => {
		const { form, target, unmount } = await mountWithMode("touch");
		const name = element<HTMLInputElement>(target, "input");

		expect(getErrors(form, { path: ["name"] })).toBe(null);
		name.dispatchEvent(new Event("focus"));
		await tick();
		expect(getErrors(form, { path: ["name"] })).toEqual(["Enter a name"]);
		unmount();
	});

	it("validates on blur", async () => {
		const { form, target, unmount } = await mountWithMode("blur");
		const name = element<HTMLInputElement>(target, "input");

		name.dispatchEvent(new Event("focus"));
		await tick();
		expect(getErrors(form, { path: ["name"] })).toBe(null);

		name.dispatchEvent(new Event("blur"));
		await tick();
		expect(getErrors(form, { path: ["name"] })).toEqual(["Enter a name"]);
		unmount();
	});

	it("validates once up front in initial mode", async () => {
		const { form, unmount } = await mountWithMode("initial");
		await tick();
		expect(getErrors(form, { path: ["name"] })).toEqual(["Enter a name"]);
		unmount();
	});

	it("keeps out of the way until submit by default", async () => {
		const form = createForm({ schema: ProfileSchema });
		const { target, unmount } = await mount(ProfileForm(form));

		element<HTMLInputElement>(target, "input").dispatchEvent(new Event("blur"));
		await tick();
		expect(getErrors(form, { path: ["name"] })).toBe(null);
		unmount();
	});
});

describe("nested fields", () => {
	it("reports an error on the field that caused it", async () => {
		const form = createForm({
			schema: ProfileSchema,
			initialInput: { name: "Ada", address: { city: "" } },
		});
		await validate(form);

		expect(getErrors(form, { path: ["name"] })).toBe(null);
		expect(getErrors(form, { path: ["address", "city"] })).toEqual(["Enter a city"]);
		expect(useField(form, { path: ["address"] }).isValid.get()).toBe(false);
		expect(useField(form, { path: ["name"] }).isValid.get()).toBe(true);
		expect(getAllErrors(form)).toEqual([{ path: ["address", "city"], errors: ["Enter a city"] }]);
	});

	it("rolls state up from a nested field to its parents", () => {
		const form = createForm({
			schema: ProfileSchema,
			initialInput: { name: "Ada", address: { city: "Paris" } },
		});
		const address = useField(form, { path: ["address"] });
		expect(address.isDirty.get()).toBe(false);

		setInput(form, { path: ["address", "city"], input: "London" });
		expect(address.isDirty.get()).toBe(true);
		expect(address.isTouched.get()).toBe(true);
		expect(form.isDirty.get()).toBe(true);
	});

	it("clears the errors of a subtree", async () => {
		const form = createForm({ schema: ProfileSchema });
		await validate(form);
		expect(getAllErrors(form)).toHaveLength(2);

		clearErrors(form, { path: ["address"] });
		expect(getAllErrors(form)).toHaveLength(1);

		clearErrors(form);
		expect(getAllErrors(form)).toHaveLength(0);
		expect(form.isValid.get()).toBe(true);
	});
});

describe("submit", () => {
	it("runs the form's own handler", async () => {
		const form = createForm({
			schema: ProfileSchema,
			initialInput: { name: "Ada", address: { city: "Paris" } },
		});
		const onSubmit = vi.fn();
		const { unmount } = await mount(ProfileForm(form, onSubmit));

		submit(form);
		await tick();
		await tick();

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: "Ada", address: { city: "Paris" } });
		unmount();
	});

	it("marks the form as validating while an async schema runs", async () => {
		const AsyncSchema = v.objectAsync({
			name: v.pipeAsync(
				v.string(),
				v.checkAsync(async (value) => value !== "taken", "Already taken"),
			),
		});
		const form = createForm({ schema: AsyncSchema, initialInput: { name: "taken" } });

		const running = validate(form);
		expect(form.isValidating.get()).toBe(true);
		await running;
		expect(form.isValidating.get()).toBe(false);
		expect(getErrors(form, { path: ["name"] })).toEqual(["Already taken"]);
	});

	it("keeps only the newest validation's errors", async () => {
		const form = createForm({ schema: ProfileSchema, initialInput: { name: "" } });
		const stale = validate(form);
		setInput(form, { path: ["name"], input: "Ada" });
		setInput(form, { path: ["address"], input: { city: "Paris" } });
		const fresh = validate(form);

		await Promise.all([stale, fresh]);
		expect(getAllErrors(form)).toHaveLength(0);
	});
});

describe("form state", () => {
	it("reports submitting while the handler runs", async () => {
		const form = createForm({
			schema: ProfileSchema,
			initialInput: { name: "Ada", address: { city: "Paris" } },
		});
		let submitting = false;
		const handler = handleSubmit(form, async () => {
			submitting = form.isSubmitting.get();
		});

		await handler();
		expect(submitting).toBe(true);
		expect(form.isSubmitting.get()).toBe(false);
	});

	it("stays undirty when an empty field is filled in and cleared again", async () => {
		const form = createForm({ schema: ProfileSchema });
		const name = useField(form, { path: ["name"] });

		name.setInput("Ada");
		expect(name.isDirty.get()).toBe(true);

		name.setInput("");
		expect(name.isDirty.get()).toBe(false);
		// editing is remembered even once the value is back where it started
		expect(name.isEdited.get()).toBe(true);
	});
});

describe("empty and missing values", () => {
	it("treats a Div-rendered form without elements as plain data", async () => {
		const form = createForm({ schema: ProfileSchema });
		await mount(Div());
		await validate(form);
		expect(getErrors(form, { path: ["name"] })).toEqual([expect.stringContaining("Expected")]);
	});
});
