import { expect, screen, userEvent } from "@tutorial/test";

export default async function test() {
	const before = screen.getAll("li").length;
	expect(before, "Render the todos as Li elements inside the Ul.").toBeGreaterThan(0);
	for (const title of ["Read the docs", "Write a component", "Ship it"]) {
		expect(
			screen.container,
			`The list should show the "${title}" todo's title.`,
		).toHaveTextContent(title);
	}

	// The point of ForEach: the list keeps up when the todos signal changes.
	await userEvent.fill(screen.getByRole("textbox"), "Learn ForEach");
	await userEvent.click(screen.getByRole("button", { name: /add/i }));

	expect(
		screen.getAll("li"),
		"Adding a todo should grow the list — .map() only renders once, use ForEach so it updates.",
	).toHaveLength(before + 1);
	expect(
		screen.container,
		"The new todo's title should appear in the list.",
	).toHaveTextContent("Learn ForEach");
}
