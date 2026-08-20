import { expect, navigate, screen } from "@tutorial/test";

export default async function test() {
	await navigate("/docs/guides/routing");
	expect(
		screen.container,
		"Render params.path — for /docs/guides/routing that's guides/routing.",
	).toHaveTextContent("guides/routing");
	await navigate("/docs/a/b/c");
	expect(screen.container, "The page should follow the path when it changes.").toHaveTextContent(
		"a/b/c",
	);
}
