import { App, Button, Div, H1, P, signal } from "@implementjs/core";

const count = signal(0);

const app = App({ target: document.getElementById("root")! });

app.render(
	Div(
		{ class: "app" },
		H1("Baseline"),
		P("count: ", count),
		Button({ onClick: () => count.increment() }, "increment"),
	),
);

performance.mark("app-mounted");
