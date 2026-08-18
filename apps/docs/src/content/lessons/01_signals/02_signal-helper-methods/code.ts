import { Button, Div, signal, P } from "@implementjs/core";

export default function App() {
	const items = signal<string[]>([]);

	function addItem() {

	}

	return Div(
		Button({ onClick: addItem }, "Add Item"),
		// don't worry too much about this right now, we'll explain it later
		P(items.bind((items) => JSON.stringify(items)))
	);
}
