import { Button, Div, H1, P, signal } from "@implementjs/core";

console.log("Welcome to the implement REPL!");

export default function App() {
	const count = signal(0);

	return Div(
		H1("implement REPL"),
		P("Edit the code above, the preview and console react as you type."),
		Button(
			{ onClick: () => count.increment() },
			count.bind((c) => (c === 0 ? "Click me" : `Clicked ${c} times!`)),
		),
	);
}
