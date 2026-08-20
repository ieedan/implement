import { expect, navigate, screen } from "@tutorial/test";

export default async function test() {
	await navigate("/about");
	const nav = screen.get("nav", "a Nav rendered by the (marketing) layout");
	expect(
		nav.querySelectorAll("a[href='/'], a[href='/about'], a[href='/contact']").length,
		"The nav needs links to /, /about, and /contact.",
	).toBe(3);
	await navigate("/contact");
	expect(
		screen.query("nav"),
		"Both marketing pages should share the nav — render it in the group's layout.",
	).not.toBeNull();
	await navigate("/");
	expect(
		screen.query("nav"),
		"The home page lives outside the group, so it should have no nav.",
	).toBeNull();
}
