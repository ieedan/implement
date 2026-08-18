import { Button, Div, signal, P } from "@implementjs/core";

export default function App() {
	const items = signal<string[]>([]);

	function addItem() {
		items.push(`New item ${items.get().length + 1}`);
	}

	return Div(
		Button({ onClick: addItem }, "Add Item"),
		P(items.bind((items) => JSON.stringify(items))),
	);
}
