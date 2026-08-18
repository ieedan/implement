import { Button, Div, H1, P, signal } from "@packages/implement";

export default function App() {
	const open = signal(false);

	return Div(
		H1("If"),
		Button("Toggle"),
		P("open is ", open.bind((value) => (value ? "true" : "false"))),
	);
}
