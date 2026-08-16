import { Div, P, Input, Button, Derived, Signal, Switch, watch } from "@packages/ui";

const root = document.getElementById("root")!;

const count = new Signal(0);
const input = new Signal("");
const dialogOpen = new Signal(false);
const subscribed = new Signal(false);

const greeting = new Derived([input], (name) => `Hello ${name}, nice to meet you!`);

const clickLevel = new Derived([count], (count): "idle" | "warming" | "cooking" => {
	if (count === 0) return "idle";
	if (count < 5) return "warming";
	return "cooking";
});

watch([count], (count) => {
	if (count > 10) {
		console.log("Count is greater than 10!");
		input.set("clickmaster!");
	}
});

Div(
	Button()
		.id("counter")
		.type("button")
		.content("Click me!")
		.on("click", () => {
			count.increment();
		}),
	P().content([count], (count) => `Clicked ${count} times!`),
	Switch(clickLevel)
		.Case("idle", P().content("No clicks yet."))
		.Case("warming", P().content("Warming up…"))
		.Case("cooking", P().content("Now we're cooking!"))
		.Exhaustive(),
	Button()
		.type("button")
		.content("Reset")
		.on("click", () => {
			count.set(0);
		}),

	Input()
		.type("text")
		.value(
			() => input.get(),
			(value) => input.set(value),
		),
	P().content(greeting),

	Input().type("checkbox").checked(subscribed),
	P().content([subscribed], (subscribed) => (subscribed ? "Subscribed" : "Not subscribed")),

	Button()
		.type("button")
		.content("Toggle Dialog")
		.className([dialogOpen], (dialogOpen) => (dialogOpen ? "dialog-open" : ""))
		.on("click", () => {
			dialogOpen.toggle();
		}),
)
	.id("app")
	.className("bg-background")
	.mount(root);
