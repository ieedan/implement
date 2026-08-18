import { expect, screen, source } from "@tutorial/test";

export default async function test() {
	expect(source(), "Render the promise with the Await helper.").toMatch(/\bAwait\s*\(/);
	expect(source(), "Show a loading message with .WhileLoading(...).").toMatch(
		/\.WhileLoading\s*\(/,
	);
	expect(source(), "Render the resolved greeting with .Then((greeting) => ...).").toMatch(
		/\.Then\s*\(/,
	);

	expect(
		screen.container,
		"The greeting shouldn't be on screen until the promise resolves — render it through Await.",
	).not.toHaveTextContent("Hello from the server!");

	// fetchGreeting resolves after 600ms; give it a little headroom.
	await new Promise((resolve) => setTimeout(resolve, 900));

	expect(
		screen.container,
		'Once the promise resolves, "Hello from the server!" should be shown.',
	).toHaveTextContent("Hello from the server!");
}
