import { Div, P, Input, Button } from "./lib/components";
import { Derived, Signal, watch } from "./lib/signal";

const root = document.getElementById("root");

const count = new Signal(0);
const input = new Signal("");
const dialogOpen = new Signal(false);

const greeting = new Derived([input], (name) => `Hello ${name}, nice to meet you!`);

watch([count], (count) => {
	if (count > 10) {
		console.log("Count is greater than 10!");
		input.set("clickmaster!");
	}
});

Div(
	Button()
		.id("counter")
		.content("Click me!")
		.on("click", () => {
			count.increment();
		}),
	P().content([count], (count) => `Clicked ${count} times!`),
	Button()
		.content("Reset")
		.on("click", () => {
			count.set(0);
		}),

	Input().on("input", (e) => {
		input.set(e.target.value);
	}),
	P().content(greeting),

	Button()
		.content("Toggle Dialog")
		.classes([dialogOpen], (dialogOpen) => `${dialogOpen ? "dialog-open" : ""}`)
		.on("click", () => {
			dialogOpen.toggle();
		}),
)
	.id("app")
	.classes("bg-background")
	.mount(root);
