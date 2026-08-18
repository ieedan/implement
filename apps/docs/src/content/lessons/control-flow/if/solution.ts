import { Button, Div, H1, If, P, signal } from "@packages/implement";

export default function App() {
	const open = signal(false);

	return Div(
		H1("If"),
		Button({ onClick: () => open.toggle() }, "Toggle"),
		If(open, P("The panel is open.")).Else(P("The panel is closed.")),
	);
}
