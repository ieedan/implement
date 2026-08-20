import { Button, Div, H1, P, signal, Switch } from "@implementjs/core";

type Status = "loading" | "success" | "error";

export default function App() {
	const status = signal<Status>("loading");

	function nextStatus() {
		status.update((current) =>
			current === "loading" ? "success" : current === "success" ? "error" : "loading",
		);
	}

	return Div(
		H1("Switch"),
		Button({ onClick: nextStatus }, "Next status"),
		Switch(status)
			.Case("loading", P("Loading…"))
			.Case("success", P("Loaded successfully!"))
			.Default(P("Something went wrong.")),
	);
}
