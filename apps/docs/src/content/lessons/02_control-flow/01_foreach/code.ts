import { Button, Div, ForEach, Form, H1, Input, Li, signal, Ul } from "@implementjs/core";

export default function App() {
	const search = signal("");
	const todos = signal([
		{ id: 1, title: "Read the docs" },
		{ id: 2, title: "Write a component" },
		{ id: 3, title: "Ship it" },
	]);

	function addTodo(e: SubmitEvent) {
		e.preventDefault();
		const title = search.get();
		if (title === "") return;
		todos.push({ id: todos.get().length + 1, title });
		search.set("");
	}

	return Div(
		H1("ForEach"),
		Form(
			{ onSubmit: addTodo, class: "flex gap-2" },
			Input({ value: search, placeholder: "What do you need to do..." }),
			Button({ type: "submit" }, "Add"),
		),
		Ul(
			// ⚠️ THIS WILL NEVER UPDATE
			...todos.get().map((todo) => Li(todo.title)),
		),
	);
}
