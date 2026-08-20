import { A, Div, H1, P } from "@implementjs/core";

export default function ErrorPage({ error, url }) {
	return Div(H1("Something went wrong"), P(A({ href: "/" }, "Take me home")));
}
