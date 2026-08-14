import { Div, P, Input, Button, Form } from "./lib/components";
import { ForEach, If } from "./lib/helper-components";
import { Derived, Signal } from "./lib/signal";

const root = document.getElementById("root")!;

const search = new Signal("");
const items = new Signal<{ title: string; timestamp: number }[]>([
	{ title: "Finish the app", timestamp: Date.now() },
]);

const totalText = new Derived(
	[items],
	(items) => `There are ${items.length} things you need to do.`,
);

function submit(e: SubmitEvent) {
	e.preventDefault();
	const title = search.get();
	if (title === "") return;
	items.push({ title, timestamp: Date.now() });
	search.set("");
}

Div(
	Form(
		Input().id("search").type("text").value(search),
		Button().id("submit").type("submit").content("Create"),
	)
		.classes("search-area")
		.on("submit", submit),

	If([items], (items) => items.length > 0, P().content(totalText)),

	Div(
		ForEach(items, ([item, i]) =>
			Div(
				Button()
					.type("button")
					.content("Delete")
					.on("click", () => items.splice(i, 1)),
			)
				.key(i)
				.content(item.title),
		),
	).id("list"),
)
	.id("list-wrapper")
	.mount(root);
