import { Button, derived, Div, H1, P, signal } from "@packages/implement";

export default function App() {
	const count = signal(1);
	const doubled = derived([count], (n) => n * 2);

	return Div(
		H1("Derived"),
		P("Count: ", count),
		P("Doubled: ", doubled),
		Button({ onClick: () => count.increment() }, "Increment"),
	);
}
