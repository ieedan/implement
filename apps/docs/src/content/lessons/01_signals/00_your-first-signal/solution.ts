import { Div, H1, P, signal } from "@implementjs/core";

export default function App() {
	const count = signal(0);

	return Div(H1("Signals"), P("Count: ", count));
}
