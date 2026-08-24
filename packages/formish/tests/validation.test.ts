// @vitest-environment happy-dom
import { Div, Input } from "@implementjs/core";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import {
	createForm,
	Field,
	Form,
	getDeepErrorEntries,
	getErrors,
	getInput,
	handleSubmit,
	setErrors,
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
		expect(getDeepErrorEntries(form)).toEqual([
			{ path: ["address", "city"], errors: ["Enter a city"] },
		]);
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

	it("clears the errors of a field", async () => {
		const form = createForm({ schema: ProfileSchema });
		await validate(form);
		expect(getDeepErrorEntries(form)).toHaveLength(2);

		setErrors(form, { path: ["address", "city"], errors: null });
		expect(getDeepErrorEntries(form)).toHaveLength(1);

		setErrors(form, { path: ["name"], errors: null });
		expect(getDeepErrorEntries(form)).toHaveLength(0);
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
		expect(getDeepErrorEntries(form)).toHaveLength(0);
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

		name.onInput("Ada");
		expect(name.isDirty.get()).toBe(true);

		name.onInput("");
		expect(name.isDirty.get()).toBe(false);
		// editing is remembered even once the value is back where it started
		expect(name.isEdited.get()).toBe(true);
	});
});

describe("fields the form never renders", () => {
	it("validates a form with no elements exactly like a rendered one", async () => {
		const form = createForm({ schema: ProfileSchema });
		await mount(Div());
		await validate(form);

		// nothing is on screen, yet the fields report the messages the schema
		// gives them rather than a type error about a value nobody supplied
		expect(getErrors(form, { path: ["name"] })).toEqual(["Enter a name"]);
		expect(getErrors(form, { path: ["address", "city"] })).toEqual(["Enter a city"]);
	});

	it("submits when the field left out has nothing more to satisfy", async () => {
		const Schema = v.object({
			email: v.pipe(v.string(), v.email("Enter a valid email")),
			// no `Field` is ever rendered for this one
			nickname: v.string(),
		});
		const form = createForm({ schema: Schema });
		const onSubmit = vi.fn();
		const { target, unmount } = await mount(
			Form(
				{ of: form, onSubmit },
				Field({ of: form, path: ["email"] }, (field) =>
					Input({ ...field.props, type: "email", value: field.input }),
				),
			),
		);

		element<HTMLInputElement>(target, "input").value = "hi@example.com";
		element<HTMLInputElement>(target, "input").dispatchEvent(new Event("input", { bubbles: true }));
		await tick();
		await handleSubmit(form, onSubmit)();

		expect(onSubmit).toHaveBeenCalledWith({ email: "hi@example.com", nickname: "" }, undefined);
		unmount();
	});

	it("blocks submit with the schema's own message when the field left out is required", async () => {
		const Schema = v.object({
			email: v.pipe(v.string(), v.email("Enter a valid email")),
			nickname: v.pipe(v.string(), v.minLength(1, "Pick a nickname")),
		});
		const form = createForm({ schema: Schema });
		const onSubmit = vi.fn();
		await handleSubmit(form, onSubmit)();

		expect(onSubmit).not.toHaveBeenCalled();
		// the error is still on a field nothing renders, but it now says what is
		// wrong instead of reading as a type mismatch
		expect(getErrors(form, { path: ["nickname"] })).toEqual(["Pick a nickname"]);
		expect(getDeepErrorEntries(form)).toContainEqual({
			path: ["nickname"],
			errors: ["Pick a nickname"],
		});
	});

	it("starts optional fields missing and nullable ones null, as each accepts", async () => {
		const Schema = v.object({
			name: v.string(),
			nickname: v.optional(v.string()),
			nudge: v.optional(v.string(), "hey"),
			exact: v.exactOptional(v.string()),
			middle: v.nullable(v.string()),
		});
		const form = createForm({ schema: Schema });
		const input = getInput(form);

		expect(input).toEqual({ name: "", nudge: "hey", middle: null });
		// an exact optional wants its key absent, not present and undefined
		expect(Object.keys(input ?? {})).not.toContain("exact");
		expect(await validate(form)).toMatchObject({ success: true });
	});

	it("takes an empty input of its own", async () => {
		const Schema = v.object({ count: v.number(), agreed: v.boolean() });
		const seeded = createForm({ schema: Schema, emptyInput: { number: 0, boolean: false } });
		const bare = createForm({ schema: Schema });

		expect(getInput(seeded)).toEqual({ count: 0, agreed: false });
		expect(await validate(seeded)).toMatchObject({ success: true });

		// only a string starts empty by default: nothing else has a value the
		// form may invent unless it is named here
		expect(getInput(bare)).toEqual({ count: undefined, agreed: undefined });
		expect(getErrors(bare, { path: ["count"] })).toBe(null);
		await validate(bare);
		expect(getErrors(bare, { path: ["count"] })).not.toBe(null);
	});

	it("seeds the fields of a nested object and of every array item", () => {
		const Schema = v.object({
			address: v.object({ city: v.string(), zip: v.string() }),
			todos: v.array(v.object({ label: v.string(), tags: v.array(v.string()) })),
		});
		const form = createForm({ schema: Schema, initialInput: { todos: [{ label: "write" }] } });

		expect(getInput(form)).toEqual({
			address: { city: "", zip: "" },
			todos: [{ label: "write", tags: [] }],
		});
	});
});
