import { expect, screen } from "@tutorial/test";

export default function test() {
	screen.get("h1", "an H1 heading for the hero");
	const description = screen.get("p", "a P element with a short description");
	const cta = screen.get("button", "a Button element for the CTA");
	expect(description, "Give the description paragraph some text.").toHaveTextContent(/\S/);
	expect(cta, "Give the CTA button a label.").toHaveTextContent(/\S/);
}
