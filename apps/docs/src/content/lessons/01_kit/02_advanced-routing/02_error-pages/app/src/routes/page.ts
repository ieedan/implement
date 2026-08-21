import { A, Div, H1, Li, P, Ul } from "@implementjs/core";

export default function Page() {
	return Div(
		H1("Home"),
		P("Two ways to reach the error page:"),
		Ul(
			Li("Type a path that doesn't exist into the URL bar, like /nowhere"),
			Li(A({ href: "/broken" }, "Visit the page that throws")),
		),
	);
}
