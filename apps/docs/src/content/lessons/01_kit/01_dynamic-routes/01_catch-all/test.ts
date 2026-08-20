import { expect, navigate, screen, source } from "@tutorial/test";

export default async function test() {
	source("src/routes/docs/[...path]/index.ts");
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
