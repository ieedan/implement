import { Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(H1("Hello, kit!"), P("This page is src/routes/page.ts."));
}
