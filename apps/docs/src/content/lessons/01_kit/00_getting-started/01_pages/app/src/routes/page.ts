import { A, Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("Home"),
		P("Welcome! This site has two pages."),
		P(A({ href: "/about" }, "Go to the about page")),
	);
}
