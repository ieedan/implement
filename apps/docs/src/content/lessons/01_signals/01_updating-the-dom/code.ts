import { Button, Div, H1, signal } from "@implementjs/core";

export default function App() {
	const count = signal(0);

	function handleClick() {}

	return Div(H1("Count: ", count), Button({ onClick: handleClick }, "Increment"));
}
