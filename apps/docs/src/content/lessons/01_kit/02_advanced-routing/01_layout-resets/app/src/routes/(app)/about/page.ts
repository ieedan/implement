import { Div, H1, P } from "@implementjs/core";

export default function Page() {
	return Div(H1("About"), P("Also inside the (app) layout — the nav sticks around."));
}
