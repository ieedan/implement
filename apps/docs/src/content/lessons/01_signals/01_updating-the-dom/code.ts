import { Button, Div, H1, signal } from "@implementjs/core";

export default function App() {
	const count = signal(0);

	return Div(H1("Count: ", count), Button("Increment"));
}
