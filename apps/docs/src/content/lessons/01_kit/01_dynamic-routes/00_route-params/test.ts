import { expect, navigate, screen } from "@tutorial/test";

export default async function test() {
	await navigate("/blog/hello-world");
	expect(
		screen.getByRole("heading"),
		"The heading should render params.slug — for /blog/hello-world that's hello-world.",
	).toHaveTextContent("hello-world");
	await navigate("/blog/kit-rocks");
	expect(
		screen.getByRole("heading"),
		"The heading should follow the slug when it changes — params are reactive.",
	).toHaveTextContent("kit-rocks");
}
