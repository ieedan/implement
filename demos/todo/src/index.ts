import { Await, Button, Derived, Div, ForEach, Form, If, Input, P, Signal } from "@packages/ui";
import { Api, type Todo } from "./api";

const api = new Api();
const root = document.getElementById("root")!;

const search = new Signal("");
const items = new Signal<Todo[]>([]);

const totalText = new Derived(
	[items],
	(items) => `There are ${items.length} things you need to do.`,
);

async function submit(e: SubmitEvent) {
	e.preventDefault();
	const title = search.get();
	if (title === "") return;
	const { data } = await api.todos.create({ title });
	if (!data) return;
	items.push(data);
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

	Await(
		api.todos.list().then(({ data, error }) => {
			if (error) throw error;
			return data ?? [];
		}),
	)
		.WhileLoading(Div().content("Loading..."))
		.Then((todos) => {
			items.set(todos.get());
			return Div(
				ForEach(items, ([item]) =>
					Div(
						Button()
							.type("button")
							.content("Delete")
							.classes("rounded border px-2 py-1")
							.on("click", async () => {
								const { error } = await api.todos.delete({ id: item.id });
								if (error) return;
								items.set(items.get().filter((todo) => todo.id !== item.id));
							}),
					)
						.key(item.id)
						.classes("flex items-center gap-2")
						.content(item.title),
				),
			)
				.id("list")
				.classes("flex flex-col gap-2");
		})
		.Catch((error) => Div().content(error.message)),
)
	.id("list-wrapper")
	.classes("flex flex-col gap-4 p-4")
	.mount(root);
