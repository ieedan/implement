import { expect, screen } from "@tutorial/test";

export default function test() {
	expect(screen.getByRole("heading"), 'The heading should say "Hello, kit!".').toHaveTextContent(
		"Hello, kit!",
	);
}
