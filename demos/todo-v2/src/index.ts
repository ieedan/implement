import { App, Button, Context, Div, ForEach, Form, If, Input, Signal } from "@packages/ui_v2";

const app = App({ target: document.body });

const ItemsCtx = new Context<Signal<Item[]>>();

app.render(TodoApp());

type Item = { id: number; text: string };

function TodoApp() {
	const items = new Signal<Item[]>([]);
	const search = new Signal("");

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const v = search.get();
		if (v === "") return;
		items.push({ id: Date.now(), text: v });
		search.set("");
	}

	return ItemsCtx.Provide(items).To(
		Div(
			{ class: "flex flex-col items-center w-full antialiased" },
			Div(
				{ class: "flex flex-col items-center w-full max-w-2xl py-4" },
				CreateForm({ onSubmit: submit, search }),
				List(),
			),
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
	return ItemsCtx.Use((items) =>
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
						Input({ value: item.bind("text"), class: "bg-transparent w-full h-9 px-2" }),
						Button(
							{
								type: "button",
								class: "bg-red-500/50 text-red-500 rounded-md px-2 py-1 h-9",
								onClick: () => {
									items.update((items) => items.filter((t) => t.id !== item.get().id));
								},
							},
							"Delete",
						),
					),
			),
		),
	);
}
