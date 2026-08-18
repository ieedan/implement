import { Button, Div, H1, If, P, signal } from "@implementjs/core";

export default function App() {
	const open = signal(false);

	return Div(
		H1("If"),
		Button({ onClick: () => open.toggle() }, "Toggle"),
		If(open).Then(P("I'm open!"))
	);
}
