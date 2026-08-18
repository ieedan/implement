import { signal, Input, Div, P } from "@implementjs/core";

export default function App() {
	const name = signal("");

	return Div(
		Input({value: name, placeholder: "Enter your name" }), 
		P(name.bind((name) => `Hello my name is, ${name}!`))
	);
}
