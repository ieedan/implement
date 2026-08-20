import { Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(H1("Home"), P("This page renders inside the (app) layout."));
}
