import { Button, Div, H1, signal } from "@packages/implement";

export default function App() {
	const count = signal(0);

	return Div(H1("Count: ", count), Button("Increment"));
}
