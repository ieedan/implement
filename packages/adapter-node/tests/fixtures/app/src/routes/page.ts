import { A, Div, H1, type Child } from "@implementjs/core";

export default function Page(): Child {
	return Div({}, H1("home"), A({ href: "/dynamic" }, "dynamic"), A({ href: "/pinned" }, "pinned"));
}
