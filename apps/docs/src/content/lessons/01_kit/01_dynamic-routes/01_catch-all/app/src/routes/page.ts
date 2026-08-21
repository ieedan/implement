import { A, Div, H1, Li, Ul } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("Documentation"),
		Ul(
			Li(A({ href: "/docs/getting-started" }, "docs/getting-started")),
			Li(A({ href: "/docs/guides/routing" }, "docs/guides/routing")),
		),
	);
}
