import { expect, screen, source } from "@tutorial/test";

export default function test() {
	expect(source(), "Render the list with the ForEach helper.").toMatch(/\bForEach\s*\(/);
	expect(screen.getAll("li"), "The list should render one Li per todo.").toHaveLength(3);
	for (const title of ["Read the docs", "Write a component", "Ship it"]) {
		expect(
			screen.container,
			`The list should show the "${title}" todo's title.`,
		).toHaveTextContent(title);
	}
}
