import { expect, navigate, screen } from "@tutorial/test";

export default async function test() {
	await navigate("/about");
	expect(
		screen.getByRole("heading"),
		'The about page should have a heading that says "About".',
	).toHaveTextContent("About");
	const paragraph = screen.query("p");
	expect(paragraph, "Add a P with a sentence about yourself.").not.toBeNull();
	expect(
		(paragraph?.textContent ?? "").trim(),
		"The paragraph shouldn't be empty — write a sentence about yourself.",
	).not.toBe("");
}
