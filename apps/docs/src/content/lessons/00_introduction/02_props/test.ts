import { expect, screen } from "@tutorial/test";

export default function test() {
	const heading = screen.get("h1", "an H1 heading");
	expect(heading, "Use the style prop to make the heading's text red.").toHaveStyle({
		color: "red",
	});
}
