import { expect, navigate, screen } from "@tutorial/test";

export default async function test() {
	await navigate("/nowhere");
	expect(
		screen.container,
		"Show error.code — a path that matches nothing is a 404.",
	).toHaveTextContent("404");
	expect(
		screen.container,
		'Show error.message — for an unmatched path that\'s "Not Found".',
	).toHaveTextContent("Not Found");
	await navigate("/broken");
	expect(
		screen.container,
		"Show error.code — a page that throws while rendering is a 500.",
	).toHaveTextContent("500");
	expect(
		screen.container,
		"Show error.message so you can see what actually went wrong.",
	).toHaveTextContent("This page always fails to render");
}
