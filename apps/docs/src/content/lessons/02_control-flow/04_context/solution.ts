// oxlint-disable-next-line no-unused-vars
import { Button, Div, ForEach, H2, Li, signal, Ul, type Signal, Context } from "@implementjs/core";

const PlantListContext = Context<Signal<string[]>>();

export default function App() {
	const vegetables = signal(["🥕", "🥦", "🥬"]);

	return Div(
		Div({ class: "flex gap-2" }, Button({ onClick: () => vegetables.push("🍅") }, "Add vegetable")),
		PlantListContext.Provide(vegetables).To(PlantListWrapper()),
	);
}

export function PlantListWrapper() {
	return Div(
		{ class: "flex gap-6" },
		Div(
			{ class: "flex gap-6" },
			// we can imagine having this list mounted at even deeper levels in the component tree
			Div(H2("Vegetables"), PlantList()),
		),
	);
}

export function PlantList() {
	return PlantListContext.Use((items) =>
		Ul(
			ForEach(
				items,
				(_, index) => index,
				(item) => Li(item),
			),
		),
	);
}
