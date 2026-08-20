import { A, Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("Zen"),
		P("No nav, no chrome — this page reset its layouts with index@.ts."),
		P(A({ href: "/" }, "Return to the noise")),
	);
}
