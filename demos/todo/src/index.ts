import {
	Await,
	Button,
	Derived,
	Div,
	ForEach,
	Form,
	H1,
	Input,
	Label,
	P,
	Signal,
	Span,
} from "@packages/ui";
import { Api, type Todo } from "./api";

const api = new Api();
const root = document.getElementById("root")!;

const search = new Signal("");
const items = new Signal<Todo[]>([]);
const ready = new Signal(false);

const totalText = new Derived([ready, items], (ready, items) => {
	if (!ready) return "\u00a0";
	if (items.length === 0) return "Nothing left to do.";
	if (items.length === 1) return "1 task.";
	return `${items.length} tasks.`;
});

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
	Div(
		H1().content("Todo").className("text-3xl font-semibold tracking-tight text-zinc-50"),
		P().content(totalText).className("text-sm text-zinc-400"),
	).className("flex flex-col gap-1"),

	Form(
		Label(
			Span().content("New task").className("sr-only"),
			Input()
				.id("search")
				.type("text")
				.placeholder("Add a task")
				.value(search)
				.className(
					"h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors duration-150 ease-out hover:border-zinc-700 focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
				),
		).className("min-w-0 flex-1"),
		Button()
			.id("submit")
			.type("submit")
			.content("Create")
			.className(
				"h-10 shrink-0 rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-950 transition-colors duration-150 ease-out hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
			),
	)
		.className("search-area flex items-center gap-2")
		.on("submit", submit),

	Await(
		api.todos.list().then(({ data, error }) => {
			if (error) throw error;
			return data ?? [];
		}),
	)
		.WhileLoading(P().content("Loading...").className("text-sm text-zinc-500"))
		.Then((todos) => {
			items.set(todos.get());
			ready.set(true);
			return Div(
				ForEach(items, ([item]) =>
					Div(
						Span().content(item.title).className("min-w-0 flex-1 text-sm text-zinc-200"),
						Button()
							.type("button")
							.content("Delete")
							.className(
								"rounded-md px-2 py-1 text-sm text-zinc-500 transition-colors duration-150 ease-out hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50",
							)
							.on("click", async () => {
								const { error } = await api.todos.delete({ id: item.id });
								if (error) return;
								items.set(items.get().filter((todo) => todo.id !== item.id));
							}),
					)
						.key(item.id)
						.className("flex items-center gap-3 py-3"),
				),
			)
				.id("list")
				.className("flex flex-col divide-y divide-zinc-800/80");
		})
		.Catch((error) => P().content(error.message).className("text-sm text-red-400")),
)
	.id("list-wrapper")
	.className("mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-6 py-16")
	.mount(root);
