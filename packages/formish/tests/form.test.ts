// @vitest-environment happy-dom
import { Div, Input, Span } from "@implementjs/core";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import {
	createForm,
	Field,
	Form,
	getInput,
	handleSubmit,
	reset,
	setErrors,
	setInput,
	useField,
	validate,
} from "../src/index";
import { element, mount, tick, type } from "./utils";

const LoginSchema = v.object({
	email: v.pipe(v.string(), v.minLength(1, "Enter your email"), v.email("Enter a valid email")),
	password: v.pipe(v.string(), v.minLength(8, "At least 8 characters")),
});

function LoginForm(form: ReturnType<typeof createForm<typeof LoginSchema>>, onSubmit = vi.fn()) {
	return Form(
		{ of: form, onSubmit },
		Field({ of: form, path: ["email"] }, (field) =>
			Div(
				Input({ ...field.props, type: "email", value: field.input }),
				Span({ class: "error" }, field.error),
			),
		),
		Field({ of: form, path: ["password"] }, (field) =>
			Div(
				Input({ ...field.props, type: "password", value: field.input }),
				Span({ class: "error" }, field.error),
			),
		),
	);
}

describe("createForm", () => {
	it("starts at the schema's empty values, untouched and undirty", () => {
		const form = createForm({ schema: LoginSchema });
		// the schema names both fields, so both start at a value rather than
		// missing — nothing had to be rendered for that to happen
		expect(getInput(form)).toEqual({ email: "", password: "" });
		expect(form.isTouched.get()).toBe(false);
		expect(form.isDirty.get()).toBe(false);
		expect(form.isSubmitted.get()).toBe(false);
	});

	it("seeds the fields from initialInput", () => {
		const form = createForm({
			schema: LoginSchema,
			initialInput: { email: "hi@example.com" },
		});
		const email = useField(form, { path: ["email"] });
		expect(email.input.get()).toBe("hi@example.com");
		expect(email.isDirty.get()).toBe(false);
	});
});

describe("fields", () => {
	it("tracks what is typed into an element", async () => {
		const form = createForm({ schema: LoginSchema });
		const { target, unmount } = await mount(LoginForm(form));

		const email = element<HTMLInputElement>(target, "input[type=email]");
		await type(email, "hi@example.com");

		expect(getInput(form, { path: ["email"] })).toBe("hi@example.com");
		expect(form.isTouched.get()).toBe(true);
		expect(form.isEdited.get()).toBe(true);
		expect(form.isDirty.get()).toBe(true);
		unmount();
	});

	it("writes the element when the field is set programmatically", async () => {
		const form = createForm({ schema: LoginSchema });
		const { target, unmount } = await mount(LoginForm(form));

		setInput(form, { path: ["email"], input: "set@example.com" });
		await tick();

		expect(element<HTMLInputElement>(target, "input[type=email]").value).toBe("set@example.com");
		unmount();
	});

	it("does not validate before the first submit by default", async () => {
		const form = createForm({ schema: LoginSchema });
		const { target, unmount } = await mount(LoginForm(form));

		await type(element<HTMLInputElement>(target, "input[type=email]"), "nope");
		expect(element(target, ".error").textContent).toBe("");
		unmount();
	});

	it("validates on input once the field has errors", async () => {
		const form = createForm({ schema: LoginSchema, validate: "input" });
		const { target, unmount } = await mount(LoginForm(form));

		await type(element<HTMLInputElement>(target, "input[type=email]"), "nope");
		expect(element(target, ".error").textContent).toBe("Enter a valid email");

		await type(element<HTMLInputElement>(target, "input[type=email]"), "hi@example.com");
		expect(element(target, ".error").textContent).toBe("");
		unmount();
	});

	it("reports an empty text field with the schema's own message", async () => {
		const form = createForm({ schema: LoginSchema });
		const { target, unmount } = await mount(LoginForm(form));

		await validate(form);
		expect(element(target, ".error").textContent).toBe("Enter your email");
		unmount();
	});
});

describe("submitting", () => {
	it("hands the schema output to the handler", async () => {
		const form = createForm({ schema: LoginSchema });
		const onSubmit = vi.fn();
		const { target, unmount } = await mount(LoginForm(form, onSubmit));

		await type(element<HTMLInputElement>(target, "input[type=email]"), "hi@example.com");
		await type(element<HTMLInputElement>(target, "input[type=password]"), "supersecret");
		await handleSubmit(form, onSubmit)();

		expect(onSubmit).toHaveBeenCalledWith(
			{ email: "hi@example.com", password: "supersecret" },
			undefined,
		);
		expect(form.isSubmitted.get()).toBe(true);
		expect(form.isSubmitting.get()).toBe(false);
		expect(form.isValid.get()).toBe(true);
		unmount();
	});

	it("keeps the handler from running on invalid input and focuses the first error", async () => {
		const form = createForm({ schema: LoginSchema });
		const onSubmit = vi.fn();
		const { target, unmount } = await mount(LoginForm(form, onSubmit));

		await type(element<HTMLInputElement>(target, "input[type=email]"), "hi@example.com");
		await handleSubmit(form, onSubmit)();

		expect(onSubmit).not.toHaveBeenCalled();
		expect(element(target, ".error", 1).textContent).toBe("At least 8 characters");
		expect(document.activeElement).toBe(element(target, "input[type=password]"));
		unmount();
	});

	it("reports a throwing handler as an error of the form", async () => {
		const form = createForm({
			schema: LoginSchema,
			initialInput: { email: "hi@example.com", password: "supersecret" },
		});
		await handleSubmit(form, () => {
			throw new Error("Server said no");
		})();

		expect(form.errors.get()).toEqual(["Server said no"]);
		expect(form.isSubmitting.get()).toBe(false);
	});

	it("validates on input after a failed submit", async () => {
		const form = createForm({ schema: LoginSchema });
		const { target, unmount } = await mount(LoginForm(form));

		await handleSubmit(form, vi.fn())();
		expect(element(target, ".error").textContent).toBe("Enter your email");

		await type(element<HTMLInputElement>(target, "input[type=email]"), "hi@example.com");
		expect(element(target, ".error").textContent).toBe("");
		unmount();
	});
});

describe("errors", () => {
	it("takes errors from outside the schema", () => {
		const form = createForm({ schema: LoginSchema });
		setErrors(form, { path: ["email"], errors: "Already taken" });
		expect(useField(form, { path: ["email"] }).error.get()).toBe("Already taken");
		expect(form.isValid.get()).toBe(false);
	});
});

describe("reset", () => {
	it("puts the form back to what it started at", async () => {
		const form = createForm({
			schema: LoginSchema,
			initialInput: { email: "hi@example.com" },
		});
		const { target, unmount } = await mount(LoginForm(form));

		await type(element<HTMLInputElement>(target, "input[type=email]"), "other@example.com");
		await handleSubmit(form, vi.fn())();
		expect(form.isDirty.get()).toBe(true);

		reset(form);
		await tick();

		expect(getInput(form, { path: ["email"] })).toBe("hi@example.com");
		expect(element<HTMLInputElement>(target, "input[type=email]").value).toBe("hi@example.com");
		expect(form.isDirty.get()).toBe(false);
		expect(form.isTouched.get()).toBe(false);
		expect(form.isSubmitted.get()).toBe(false);
		expect(form.isValid.get()).toBe(true);
		unmount();
	});

	it("takes a new starting point", () => {
		const form = createForm({ schema: LoginSchema });
		reset(form, { initialInput: { email: "new@example.com", password: "supersecret" } });
		expect(getInput(form)).toEqual({ email: "new@example.com", password: "supersecret" });
		expect(form.isDirty.get()).toBe(false);
	});
});
