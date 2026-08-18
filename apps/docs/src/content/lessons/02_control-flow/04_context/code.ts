// oxlint-disable-next-line no-unused-vars
import { Button, Div, ForEach, H2, Li, signal, Ul, type Signal, Context } from "@implementjs/core";

export default function App() {
	const vegetables = signal(["🥕", "🥦", "🥬"]);

	return Div(
		Div({ class: "flex gap-2" }, Button({ onClick: () => vegetables.push("🍅") }, "Add vegetable")),
		PlantListWrapper({ vegetables }),
	);
}

export function PlantListWrapper({ vegetables }: { vegetables: Signal<string[]> }) {
	return Div(
		{ class: "flex gap-6" },
		Div(
			{ class: "flex gap-6" },
			// we can imagine having this list mounted at even deeper levels in the component tree
			Div(H2("Vegetables"), PlantList({ items: vegetables })),
		),
	);
}

export function PlantList({ items }: { items: Signal<string[]> }) {
	return Ul(
		ForEach(
			items,
			(_, index) => index,
			(item) => Li(item),
		),
	);
}
