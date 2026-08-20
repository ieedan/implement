import { expect, navigate, screen } from "@tutorial/test";

export default async function test() {
	await navigate("/about");
	expect(screen.query("nav"), "/about should keep the (app) layout's header nav.").not.toBeNull();
	await navigate("/zen");
	expect(
		screen.query("nav"),
		"index@.ts resets to the root layout, so /zen should have no nav.",
	).toBeNull();
	expect(
		(screen.container.textContent ?? "").trim(),
		"Give the zen page some calm content of your own.",
	).not.toBe("");
}
