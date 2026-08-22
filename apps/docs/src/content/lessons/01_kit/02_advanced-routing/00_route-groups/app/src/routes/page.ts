import { A, Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("Home"),
		P("The home page is outside the (marketing) group — no shared nav here."),
		P(A({ href: "/about" }, "About"), " · ", A({ href: "/contact" }, "Contact")),
	);
}
