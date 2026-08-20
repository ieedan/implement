import { A, Div, H1, P } from "@implementjs/core";

export default function Page({ params }) {
	return Div(H1("Some post"), P(A({ href: "/" }, "Back to all posts")));
}
