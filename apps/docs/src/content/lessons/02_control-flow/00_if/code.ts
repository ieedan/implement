import { Button, Div, H1, P, signal, If } from "@implementjs/core";

export default function App() {
	const open = signal(false);

	return Div(H1("If"), Button({ onClick: () => open.toggle() }, "Toggle"), P("I'm open!"));
}
