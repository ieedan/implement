import { expect, screen, source, userEvent } from "@tutorial/test";

export default async function test() {
	const button = screen.getByRole("button");
	expect(source(), "Add an onClick handler to the button's props object.").toMatch(/\bonClick\s*:/);
	// The lesson leaves the handler's effect up to the user (alert() is stubbed
	// while checks run) — just make sure clicking doesn't crash.
	await userEvent.click(button);
}
