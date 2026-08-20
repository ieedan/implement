import { A, derived, Div, H1, P } from "@implementjs/core";

export default function Page({ data }) {
	const post = derived([data], ({ post }) => post);
	return Div(
		H1(derived([post], (value) => (value ? value.title : "Post not found"))),
		P(derived([post], (value) => (value ? value.body : "The load returned no post."))),
		P(A({ href: "/" }, "← All posts")),
	);
}
