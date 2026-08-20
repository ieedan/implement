import { A, Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("About"),
		P("I'm learning implement kit, one route at a time."),
		P(A({ href: "/" }, "Back home")),
	);
}
