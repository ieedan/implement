import { expect, screen, userEvent } from "@tutorial/test";

export default async function test() {
	const input = screen.getByRole("textbox");
	await userEvent.type(input, "Ada");
	expect(
		screen.container,
		"Typing in the input should show the name in the message — bind name to the input's value and render it with name.bind(...).",
	).toHaveTextContent("Ada");
}
