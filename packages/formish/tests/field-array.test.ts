// @vitest-environment happy-dom
import { Div, ForEach, Input, Span } from "@implementjs/core";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import {
	createForm,
	Field,
	FieldArray,
	focus,
	Form,
	getInput,
	handleSubmit,
	insert,
	move,
	remove,
	reset,
	setInput,
	swap,
	useFieldArray,
} from "../src/index";
import { element, mount, tick, type } from "./utils";

const TodosSchema = v.object({
	todos: v.array(
		v.object({
			label: v.pipe(v.string(), v.minLength(1, "Enter a label")),
		}),
	),
});

type TodosForm = ReturnType<typeof createForm<typeof TodosSchema>>;

function TodosForm(form: TodosForm, onSubmit = vi.fn()) {
	return Form(
		{ of: form, onSubmit },
		FieldArray({ of: form, path: ["todos"] }, (todos) =>
			Div(
				ForEach(
					todos.items,
					(id) => id,
					(_id, index) =>
						Field({ of: form, path: todos.itemPath(index, "label") }, (field) =>
							Div(
								Input({ ...field.props, value: field.input }),
								Span({ class: "error" }, field.error),
							),
						),
				),
			),
		),
	);
}

function values(target: ParentNode): string[] {
	return [...target.querySelectorAll("input")].map((input) => input.value);
}

function errors(target: ParentNode): string[] {
	return [...target.querySelectorAll(".error")].map((span) => span.textContent ?? "");
}

describe("field arrays", () => {
	it("renders a row per item", async () => {
		const form = createForm({
			schema: TodosSchema,
			initialInput: { todos: [{ label: "one" }, { label: "two" }] },
		});
		const { target, unmount } = await mount(TodosForm(form));

		expect(values(target)).toEqual(["one", "two"]);
		expect(useFieldArray(form, { path: ["todos"] }).items.get()).toHaveLength(2);
		unmount();
	});

	it("inserts and removes items", async () => {
		const form = createForm({ schema: TodosSchema, initialInput: { todos: [] } });
		const { target, unmount } = await mount(TodosForm(form));

		insert(form, { path: ["todos"], initialInput: { label: "one" } });
		insert(form, { path: ["todos"], initialInput: { label: "two" } });
		await tick();
		expect(values(target)).toEqual(["one", "two"]);

		remove(form, { path: ["todos"], at: 0 });
		await tick();
		expect(values(target)).toEqual(["two"]);
		expect(getInput(form, { path: ["todos"] })).toEqual([{ label: "two" }]);
		unmount();
	});

	it("inserts at a position", async () => {
		const form = createForm({
			schema: TodosSchema,
			initialInput: { todos: [{ label: "one" }, { label: "three" }] },
		});
		const { target, unmount } = await mount(TodosForm(form));

		insert(form, { path: ["todos"], at: 1, initialInput: { label: "two" } });
		await tick();

		expect(values(target)).toEqual(["one", "two", "three"]);
		unmount();
	});

	it("keeps each row's errors with its item when the list changes", async () => {
		const form = createForm({
			schema: TodosSchema,
			initialInput: { todos: [{ label: "one" }, { label: "" }] },
			validate: "input",
		});
		const { target, unmount } = await mount(TodosForm(form));

		await handleSubmit(form, vi.fn())();
		expect(errors(target)).toEqual(["", "Enter a label"]);

		move(form, { path: ["todos"], from: 1, to: 0 });
		await tick();
		expect(values(target)).toEqual(["", "one"]);
		expect(errors(target)).toEqual(["Enter a label", ""]);

		swap(form, { path: ["todos"], at: 0, and: 1 });
		await tick();
		expect(errors(target)).toEqual(["", "Enter a label"]);

		remove(form, { path: ["todos"], at: 0 });
		await tick();
		expect(errors(target)).toEqual(["Enter a label"]);
		unmount();
	});

	it("edits the item a row points at after a move", async () => {
		const form = createForm({
			schema: TodosSchema,
			initialInput: { todos: [{ label: "one" }, { label: "two" }] },
		});
		const { target, unmount } = await mount(TodosForm(form));

		move(form, { path: ["todos"], from: 0, to: 1 });
		await tick();
		await type(element<HTMLInputElement>(target, "input", 0), "edited");

		expect(getInput(form, { path: ["todos"] })).toEqual([{ label: "edited" }, { label: "one" }]);
		unmount();
	});

	it("keeps each row's element with the field it moved to", async () => {
		const form = createForm({
			schema: TodosSchema,
			initialInput: { todos: [{ label: "one" }, { label: "two" }] },
		});
		const { target, unmount } = await mount(TodosForm(form));
		const first = element<HTMLInputElement>(target, "input", 0);

		// `ForEach` moves the node rather than rebuilding it, so the element has to
		// follow its row to the field store the row now points at
		move(form, { path: ["todos"], from: 0, to: 1 });
		await tick();

		focus(form, { path: ["todos", 1, "label"] });
		expect(document.activeElement).toBe(first);
		expect(first.value).toBe("one");
		unmount();
	});

	it("grows and shrinks with a programmatic write", async () => {
		const form = createForm({ schema: TodosSchema, initialInput: { todos: [] } });
		const { target, unmount } = await mount(TodosForm(form));

		setInput(form, { path: ["todos"], input: [{ label: "one" }, { label: "two" }] });
		await tick();
		expect(values(target)).toEqual(["one", "two"]);

		setInput(form, { path: ["todos"], input: [{ label: "only" }] });
		await tick();
		expect(values(target)).toEqual(["only"]);
		unmount();
	});

	it("resets back to the items it started with", async () => {
		const form = createForm({
			schema: TodosSchema,
			initialInput: { todos: [{ label: "one" }] },
		});
		const { target, unmount } = await mount(TodosForm(form));

		insert(form, { path: ["todos"], initialInput: { label: "two" } });
		await tick();
		expect(values(target)).toEqual(["one", "two"]);
		expect(form.isDirty.get()).toBe(true);

		reset(form);
		await tick();
		expect(values(target)).toEqual(["one"]);
		expect(form.isDirty.get()).toBe(false);
		unmount();
	});

	it("is undirty again after a reset that only put a row's value back", async () => {
		const form = createForm({
			schema: TodosSchema,
			initialInput: { todos: [{ label: "one" }] },
		});
		const todos = useFieldArray(form, { path: ["todos"] });
		const { target, unmount } = await mount(TodosForm(form));

		await type(element<HTMLInputElement>(target, "input", 0), "edited");
		expect(todos.isDirty.get()).toBe(true);

		// the list itself never changed, so the array has to compare its ids by
		// what they are rather than by which array holds them
		reset(form);
		await tick();
		expect(values(target)).toEqual(["one"]);
		expect(todos.isDirty.get()).toBe(false);
		expect(form.isDirty.get()).toBe(false);
		unmount();
	});

	it("reports the state of the array as a whole", async () => {
		const form = createForm({
			schema: TodosSchema,
			initialInput: { todos: [{ label: "one" }] },
		});
		const todos = useFieldArray(form, { path: ["todos"] });
		expect(todos.isDirty.get()).toBe(false);
		expect(todos.isTouched.get()).toBe(false);

		insert(form, { path: ["todos"], initialInput: { label: "two" } });
		expect(todos.isDirty.get()).toBe(true);
		expect(todos.isTouched.get()).toBe(true);
		expect(todos.items.get()).toHaveLength(2);
	});

	it("mutates through the store's own methods", async () => {
		const form = createForm({ schema: TodosSchema, initialInput: { todos: [] } });
		const todos = useFieldArray(form, { path: ["todos"] });

		todos.insert({ initialInput: { label: "one" } });
		todos.insert({ initialInput: { label: "two" } });
		todos.move({ from: 0, to: 1 });
		expect(getInput(form, { path: ["todos"] })).toEqual([{ label: "two" }, { label: "one" }]);

		todos.replace({ at: 0, initialInput: { label: "new" } });
		todos.remove({ at: 1 });
		expect(getInput(form, { path: ["todos"] })).toEqual([{ label: "new" }]);
	});
});

describe("array methods out of range", () => {
	function form() {
		return createForm({
			schema: TodosSchema,
			initialInput: { todos: [{ label: "one" }, { label: "two" }] },
		});
	}

	it("leaves the list alone for an index that is not there", () => {
		const todos = form();
		remove(todos, { path: ["todos"], at: 5 });
		move(todos, { path: ["todos"], from: 0, to: 9 });
		swap(todos, { path: ["todos"], at: -1, and: 0 });
		expect(getInput(todos, { path: ["todos"] })).toEqual([{ label: "one" }, { label: "two" }]);
		expect(useFieldArray(todos, { path: ["todos"] }).items.get()).toHaveLength(2);
	});

	it("ignores an insert past the end of the list, and appends without an index", () => {
		const todos = form();
		insert(todos, { path: ["todos"], at: 99, initialInput: { label: "three" } });
		expect(getInput(todos, { path: ["todos"] })).toEqual([{ label: "one" }, { label: "two" }]);

		insert(todos, { path: ["todos"], initialInput: { label: "three" } });
		expect(getInput(todos, { path: ["todos"] })).toEqual([
			{ label: "one" },
			{ label: "two" },
			{ label: "three" },
		]);
	});
});
