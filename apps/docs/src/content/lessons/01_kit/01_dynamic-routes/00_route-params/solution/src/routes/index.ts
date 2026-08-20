import { A, Div, H1, Li, Ul } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("My blog"),
		Ul(
			Li(A({ href: "/blog/hello-world" }, "hello-world")),
			Li(A({ href: "/blog/routing-deep-dive" }, "routing-deep-dive")),
		),
	);
}
