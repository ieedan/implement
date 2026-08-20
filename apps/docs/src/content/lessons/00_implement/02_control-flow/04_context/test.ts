import { expect, screen, source, userEvent } from "@tutorial/test";

export default async function test() {
	// The refactored app renders exactly like the prop-drilled starter, so the
	// mechanism has to be checked in the source.
	expect(
		source(),
		"Create a context for the list — const PlantListContext = context<Signal<string[]>>().",
	).toMatch(/\bcontext\s*[<(]/);
	expect(
		source(),
		"Provide the vegetables to the tree with PlantListContext.Provide(vegetables).To(...).",
	).toMatch(/\.Provide\s*\(/);
	expect(
		source(),
		"Pass the wrapped components to the provider with .To(PlantListWrapper()).",
	).toMatch(/\.To\s*\(/);
	expect(
		source(),
		"Read the context in PlantList with PlantListContext.Use((items) => ...).",
	).toMatch(/\.Use\s*\(/);

	// And the refactor shouldn't change what the app does.
	const before = screen.getAll("li").length;
	expect(before, "The vegetable list should still render its items.").toBeGreaterThan(0);
	for (const vegetable of ["🥕", "🥦", "🥬"]) {
		expect(
			screen.container,
			`The list should still show the ${vegetable} vegetable.`,
		).toHaveTextContent(vegetable);
	}

	await userEvent.click(screen.getByRole("button", { name: /add/i }));
	expect(
		screen.getAll("li"),
		'Clicking "Add vegetable" should still add an item to the list.',
	).toHaveLength(before + 1);
}
