import { expect, navigate, screen } from "@tutorial/test";

export default async function test() {
	const links = () =>
		screen
			.get("nav", "a Nav rendered by the root layout")
			.querySelectorAll("a[href='/'], a[href='/about']");
	expect(links().length, "The nav needs links to both / and /about.").toBe(2);
	await navigate("/about");
	expect(
		screen.query("nav"),
		"The nav should be on every page — render it in the layout, above children.",
	).not.toBeNull();
}
