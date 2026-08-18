import { Div, ForEach, H1, Li, signal, Ul } from "@packages/implement";

export default function App() {
	const todos = signal([
		{ id: 1, title: "Read the docs" },
		{ id: 2, title: "Write a component" },
		{ id: 3, title: "Ship it" },
	]);

	return Div(
		H1("ForEach"),
		Ul(
			ForEach(
				todos,
				(todo) => todo.id,
				(todo) => Li(todo.bind("title")),
			),
		),
	);
}
