import { A, Div, H1, P } from "@implementjs/core";

export default function Page({ params }) {
	return Div(H1(params.slug), P(A({ href: "/" }, "Back to all posts")));
}
