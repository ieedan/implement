import { Div, H1, Input, P, signal } from "@implementjs/core";

export default function App() {
	const name = signal("");

	return Div(H1("Hello"), Input({ placeholder: "Your name" }), P("You typed: ", name));
}
