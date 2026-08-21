// @vitest-environment node
import { Div, Input, Span } from "@implementjs/core";
import { renderToString } from "@implementjs/core/server";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { createForm, Field, Form, getInput, validate } from "../src/index";

const LoginSchema = v.object({
	email: v.pipe(v.string(), v.minLength(1, "Enter your email")),
});

/** No `document` here, which is what a kit server render looks like. */
describe("server rendering", () => {
	it("renders a form to html", () => {
		const form = createForm({
			schema: LoginSchema,
			initialInput: { email: "hi@example.com" },
		});

		const { html } = renderToString(
			Form(
				{ of: form, onSubmit: vi.fn() },
				Field({ of: form, path: ["email"] }, (field) =>
					Div(
						Input({ ...field.props, type: "email", value: field.input }),
						Span({ class: "error" }, field.error),
					),
				),
			),
		);

		expect(html).toContain('name="email"');
		expect(html).toContain('value="hi@example.com"');
		// core serializes prop names as written; the parser lowercases them
		expect(html).toMatch(/novalidate/i);
	});

	it("validates without a DOM to read empty fields from", async () => {
		const form = createForm({ schema: LoginSchema });
		const result = await validate(form);

		expect(result.issues).toBeDefined();
		expect(getInput(form)).toEqual({});
	});
});
