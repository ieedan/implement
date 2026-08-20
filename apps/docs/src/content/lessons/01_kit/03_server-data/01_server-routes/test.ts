import { expect, navigate, screen, source } from "@tutorial/test";

export default async function test() {
	await navigate("/about.md");
	expect(
		screen.container,
		"GET should return markdown starting with a # About this site heading.",
	).toHaveTextContent("# About this site");
	expect(
		screen.container,
		"The response body still says TODO — return the real markdown.",
	).not.toHaveTextContent("TODO");
	expect(
		source("src/routes/about/.md/server.ts"),
		"Keep the text/markdown content-type header on the Response.",
	).toMatch("text/markdown");
}
