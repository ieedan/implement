import { A, Code, Div, H1, P } from "@implementjs/core";

export default function Page({ params }) {
	return Div(H1("Docs"), P("You are reading: ", Code("?")), P(A({ href: "/" }, "Index")));
}
