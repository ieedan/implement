import { Await, Div, H1, P } from "@implementjs/core";

function fetchGreeting(): Promise<string> {
	return new Promise((resolve) => {
		setTimeout(() => resolve("Hello from the server!"), 600);
	});
}

export default function App() {
	const greeting = fetchGreeting();

	return Div(
		H1("Await"),
		Await(greeting)
			.WhileLoading(P("Loading greeting…"))
			.Then((greeting) => P(greeting))
			.Catch((error) => P("Something went wrong: ", error.message)),
	);
}
