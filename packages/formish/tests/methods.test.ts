// @vitest-environment happy-dom
import { Div, Input } from "@implementjs/core";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
	createForm,
	Field,
	focus,
	Form,
	getDeepError,
	getDeepErrorEntries,
	getDeepErrorEntry,
	getDeepErrors,
	getDirtyInput,
	getDirtyPaths,
	getErrors,
	getInput,
	insert,
	isDirty,
	isEdited,
	isTouched,
	isValid,
	pickDirty,
	reset,
	setErrors,
	setInput,
	validate,
} from "../src/index";
import { element, mount, tick } from "./utils";

const ProfileSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, "Enter a name")),
	address: v.object({
		city: v.pipe(v.string(), v.minLength(1, "Enter a city")),
		zip: v.pipe(v.string(), v.minLength(1, "Enter a zip")),
	}),
	tags: v.array(v.string()),
});

function profile() {
	return createForm({
		schema: ProfileSchema,
		initialInput: { name: "Ada", address: { city: "London", zip: "E1" }, tags: ["one"] },
	});
}

describe("deep errors", () => {
	it("reads the errors of a subtree, of the first erroring field, and as entries", async () => {
		const form = createForm({ schema: ProfileSchema });
		await validate(form);

		// the field's own errors stop at the field; the deep ones do not
		expect(getErrors(form, { path: ["address"] })).toBe(null);
		expect(getDeepErrors(form, { path: ["address"] })).toEqual(["Enter a city", "Enter a zip"]);
		expect(getDeepError(form, { path: ["address"] })).toBe("Enter a city");
		expect(getDeepErrorEntry(form, { path: ["address"] })).toEqual({
			path: ["address", "city"],
			errors: ["Enter a city"],
		});
		expect(getDeepErrorEntries(form)).toEqual([
			{ path: ["name"], errors: ["Enter a name"] },
			{ path: ["address", "city"], errors: ["Enter a city"] },
			{ path: ["address", "zip"], errors: ["Enter a zip"] },
		]);
	});

	it("reports the form's own errors under an empty path", async () => {
		const Schema = v.pipe(
			v.object({ password: v.string(), confirm: v.string() }),
			v.check((input) => input.password === input.confirm, "Passwords do not match"),
		);
		const form = createForm({ schema: Schema, initialInput: { password: "a", confirm: "b" } });
		await validate(form);

		expect(form.errors.get()).toEqual(["Passwords do not match"]);
		expect(getDeepErrorEntries(form)).toEqual([{ path: [], errors: ["Passwords do not match"] }]);
	});

	it("clears a field's errors with null", async () => {
		const form = createForm({ schema: ProfileSchema });
		setErrors(form, { path: ["name"], errors: ["Taken"] });
		expect(isValid(form, { path: ["name"] })).toBe(false);

		setErrors(form, { path: ["name"], errors: null });
		expect(isValid(form, { path: ["name"] })).toBe(true);
	});
});

describe("state readers", () => {
	it("answers for a field and for everything below it", () => {
		const form = profile();
		expect(isTouched(form)).toBe(false);
		expect(isEdited(form)).toBe(false);
		expect(isDirty(form)).toBe(false);

		setInput(form, { path: ["address", "city"], input: "Paris" });

		expect(isDirty(form, { path: ["address", "city"] })).toBe(true);
		expect(isDirty(form, { path: ["address"] })).toBe(true);
		expect(isDirty(form, { path: ["name"] })).toBe(false);
		expect(isTouched(form)).toBe(true);
		expect(isEdited(form)).toBe(true);
	});
});

describe("dirty input", () => {
	it("reads only what changed, and the paths that changed", () => {
		const form = profile();
		expect(getDirtyInput(form)).toBeUndefined();
		expect(getDirtyPaths(form)).toEqual([]);

		setInput(form, { path: ["address", "city"], input: "Paris" });

		// an object keeps only its dirty keys; an array is reported whole
		expect(getDirtyInput(form)).toEqual({ address: { city: "Paris" } });
		expect(getDirtyPaths(form)).toEqual([["address", "city"]]);

		insert(form, { path: ["tags"], initialInput: "two" });
		expect(getDirtyPaths(form)).toContainEqual(["tags"]);
		expect(getDirtyInput(form)).toMatchObject({ tags: ["one", "two"] });
	});

	it("narrows a value of its own through the form", () => {
		const form = profile();
		expect(pickDirty(form, { from: { name: "Ada", extra: 1 } })).toBeUndefined();

		setInput(form, { path: ["name"], input: "Grace" });
		expect(pickDirty(form, { from: { name: "from the server", address: { city: "x" } } })).toEqual({
			name: "from the server",
		});
	});
});

describe("reset", () => {
	it("keeps what it is told to keep", async () => {
		const form = profile();
		await validate(form);
		setInput(form, { path: ["name"], input: "" });
		setErrors(form, { path: ["name"], errors: ["Taken"] });

		reset(form, { keepInput: true, keepErrors: true, keepTouched: true });
		expect(getInput(form, { path: ["name"] })).toBe("");
		expect(getErrors(form, { path: ["name"] })).toEqual(["Taken"]);
		expect(isTouched(form, { path: ["name"] })).toBe(true);
		// nothing said to keep the edited state, so it is gone
		expect(isEdited(form, { path: ["name"] })).toBe(false);
	});

	it("takes a new starting point for a single field", () => {
		const form = profile();
		reset(form, { path: ["address"], initialInput: { city: "Paris", zip: "75001" } });

		expect(getInput(form, { path: ["address"] })).toEqual({ city: "Paris", zip: "75001" });
		expect(isDirty(form, { path: ["address"] })).toBe(false);

		setInput(form, { path: ["address", "city"], input: "Lyon" });
		reset(form, { path: ["address"] });
		expect(getInput(form, { path: ["address", "city"] })).toBe("Paris");
	});
});

describe("elements", () => {
	it("registers the elements a field renders, and focuses the first that can take it", async () => {
		const form = createForm({ schema: ProfileSchema });
		const { target, unmount } = await mount(
			Form(
				{ of: form, onSubmit: () => undefined },
				Field({ of: form, path: ["name"] }, (field) =>
					Div(Input({ ...field.props, value: field.input })),
				),
			),
		);

		focus(form, { path: ["name"] });
		expect(document.activeElement).toBe(element(target, "input"));
		unmount();
	});

	it("focuses the first erroring field on submit", async () => {
		const form = createForm({ schema: ProfileSchema });
		const { target, unmount } = await mount(
			Form(
				{ of: form, onSubmit: () => undefined },
				Field({ of: form, path: ["address", "city"] }, (field) =>
					Input({ ...field.props, value: field.input, class: "city" }),
				),
				Field({ of: form, path: ["address", "zip"] }, (field) =>
					Input({ ...field.props, value: field.input, class: "zip" }),
				),
			),
		);

		await validate(form, { shouldFocus: true });
		await tick();
		expect(document.activeElement).toBe(element(target, "input.city"));
		unmount();
	});
});
