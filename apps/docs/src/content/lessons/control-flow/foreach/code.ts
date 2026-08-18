import { Div, H1, Li, P, signal, Ul } from "@packages/implement";

export default function App() {
	const todos = signal([
		{ id: 1, title: "Read the docs" },
		{ id: 2, title: "Write a component" },
		{ id: 3, title: "Ship it" },
	]);

	return Div(
		H1("ForEach"),
		P(todos.bind((list) => `${list.length} items`)),
		Ul(Li("Render the list here")),
	);
}
