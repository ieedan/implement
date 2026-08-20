import { A, Div, H1, Li, Ul } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("My blog"),
		Ul(
			Li(A({ href: "/blog/hello-world" }, "Hello world")),
			Li(A({ href: "/blog/loading-data" }, "Loading data")),
		),
	);
}
