import { A, Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("About this site"),
		P("Built with implement kit."),
		P(A({ href: "/about.md" }, "View as Markdown")),
		P(A({ href: "/" }, "← Home")),
	);
}
