import { expect, screen } from "@tutorial/test";

export default function test() {
	const heading = screen.getByRole("heading", { level: 1 });
	expect(heading, 'Change the H1 text to say "Hello, Implement!".').toHaveTextContent(
		/hello,?\s*implement/i,
	);
}
