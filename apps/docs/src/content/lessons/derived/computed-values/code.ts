import { Button, Div, H1, P, signal } from "@packages/implement";

export default function App() {
	const count = signal(1);

	return Div(
		H1("Derived"),
		P("Count: ", count),
		P("Doubled: ", count),
		Button({ onClick: () => count.increment() }, "Increment"),
	);
}
