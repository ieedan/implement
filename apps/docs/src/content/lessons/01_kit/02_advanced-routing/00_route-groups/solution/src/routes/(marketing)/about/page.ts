import { Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(H1("About"), P("This page renders at /about, inside the marketing layout."));
}
