import { expect, navigate, screen } from "@tutorial/test";

export default async function test() {
	await navigate("/blog/hello-world");
	expect(
		screen.getByRole("heading"),
		"The load should return the matching post — /blog/hello-world shows its title.",
	).toHaveTextContent("Hello world");
	expect(screen.container, "The post's body should render too.").toHaveTextContent(
		"fresh off the server",
	);
	await navigate("/blog/loading-data");
	expect(screen.getByRole("heading"), "Each slug should load its own post.").toHaveTextContent(
		"Loading data",
	);
	await navigate("/blog/nope");
	expect(
		screen.container,
		"A slug that isn't in POSTS should return { post: null } and keep the not-found rendering.",
	).toHaveTextContent("Post not found");
}
