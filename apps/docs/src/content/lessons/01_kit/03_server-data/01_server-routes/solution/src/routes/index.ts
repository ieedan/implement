import { A, Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("Server routes"),
		P("A URL doesn't have to be a page."),
		P(A({ href: "/about" }, "About this site")),
	);
}
