import { Button } from "@implementjs/core";

export default function App() {
	return Button({ onClick: () => alert('Clicked!') }, "Click me");
}
