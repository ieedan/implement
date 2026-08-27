import { Div, H1, type Child } from "@implementjs/core";

export default function Page(): Child {
	return Div({}, H1("mcp app"));
}
