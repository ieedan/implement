import {
	App,
	Await,
	Button,
	Context,
	derived,
	Div,
	ForEach,
	Form,
	If,
	Input,
	signal,
	watch,
	type Signal,
} from "@packages/implement";
import { Api, type Todo } from "./api";

const api = new Api();
const app = App({ target: document.body });
const TodosContext = Context<Signal<Todo[]>>();

app.render(TodoApp());

function TodoApp() {
	const items = signal<Todo[]>([]);
	const search = signal("");

	const isNotEmpty = derived([items], (items) => items.length > 0);

	watch([isNotEmpty], (isNotEmpty) => {
		console.log(isNotEmpty);
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

	return Div(
		{ class: "flex flex-col items-center w-full antialiased" },
		Div(
			{ class: "flex flex-col items-center w-full max-w-2xl py-4" },
			CreateForm({ onSubmit: submit, search }),
			Await(
				api.todos.list().then(({ data, error }) => {
					if (error) throw error;
					return data ?? [];
				}),
			)
				.WhileLoading(Div({ class: "text-zinc-500 py-2" }, "Loading..."))
				.Then((todos) => {
					items.set(todos);
					return TodosContext.Provide(items).To(List());
				})
				.Catch((error) => Div({ class: "text-red-400 py-2" }, error.message)),
		),
	);
}

function CreateForm({
	onSubmit,
	search,
}: {
	onSubmit: (e: SubmitEvent) => void;
	search: Signal<string>;
}) {
	return Form(
		{ onSubmit, class: "flex items-center gap-2 w-full" },
		Input({
			value: search,
			class: "border border-zinc-700 rounded-md h-9 px-2 w-full",
			placeholder: "I need to...",
		}),
		Button(
			{ type: "submit", class: "border bg-white text-black rounded-md px-2 py-1 h-9" },
			"Create",
		),
	);
}

function List() {
	return TodosContext.Use((items) =>
		Div(
			{ class: "py-2 w-full flex flex-col gap-2" },
			If(items.bind((items) => items.length > 0)).Then(
				Div(
					{ class: "text-center text-zinc-500" },
					items.bind((items) => `You have ${items.length} items to do.`),
				),
			),
			ForEach(
				items,
				(item) => item.id,
				(item) =>
					Div(
						{ class: "border border-zinc-700 rounded-md p-2 w-full flex items-center gap-2" },
						Input({
							value: item.bind(
								(item) => item.title,
								(prev, next) => {
									prev.title = next;
								},
							),
							class: "bg-transparent w-full h-9 px-2",
						}),
						Button(
							{
								type: "button",
								class: "bg-red-500/50 text-red-500 rounded-md px-2 py-1 h-9",
								onClick: async () => {
									const { error } = await api.todos.delete({ id: item.get().id });
									if (error) return;
									items.update((todos) => todos.filter((todo) => todo.id !== item.get().id));
								},
							},
							"Delete",
						),
					),
			),
		),
	);
}
