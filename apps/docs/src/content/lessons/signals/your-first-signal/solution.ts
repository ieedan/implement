import { Div, H1, P, signal } from "@packages/implement";

export default function App() {
	const count = signal(0);

	return Div(H1("Signals"), P("Count: ", count));
}
