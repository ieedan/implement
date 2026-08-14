import { Div, P, Input, Button, Form, ForEach, If, Derived, Signal } from "@packages/ui";

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
		Input().id("search").type("text").value(search).classes("rounded border px-2 py-1"),
		Button().id("submit").type("submit").content("Create").classes("rounded border px-3 py-1"),
	)
		.classes("search-area flex gap-2")
		.on("submit", submit),

	If([items], (items) => items.length > 0, P().content(totalText)),

	Div(
		ForEach(items, ([item, i]) =>
			Div(
				Button()
					.type("button")
					.content("Delete")
					.classes("rounded border px-2 py-1")
					.on("click", () => items.splice(i, 1)),
			)
				.key(i)
				.classes("flex items-center gap-2")
				.content(item.title),
		),
	)
		.id("list")
		.classes("flex flex-col gap-2"),
)
	.id("list-wrapper")
	.classes("flex flex-col gap-4 p-4")
	.mount(root);
