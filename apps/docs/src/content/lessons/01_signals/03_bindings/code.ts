import { signal, Input, P, Div } from "@implementjs/core";

export default function App() {
	const name = signal("");

	return Div(
		Input({ placeholder: "Enter your name" })
	);
}
