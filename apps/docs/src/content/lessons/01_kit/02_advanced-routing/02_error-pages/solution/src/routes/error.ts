import { A, Div, H1, P } from "@implementjs/core";

export default function ErrorPage({ error, url }) {
	return Div(H1(String(error.code)), P(error.message), P(A({ href: "/" }, "Take me home")));
}
