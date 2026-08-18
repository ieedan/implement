import { Button, Div, H1, P } from "@packages/implement";

export default function App() {
	return Div(H1("Elements"), P("Factories build real DOM nodes."), Button("Next"));
}
