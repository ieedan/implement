import { Div, H1, P } from "@implementjs/core";

console.log("Welcome to the implement REPL!");

export default function App() {
	return Div(
		H1("implement REPL"),
		P("Edit the code above, the preview and console react as you type."),
	);
}
