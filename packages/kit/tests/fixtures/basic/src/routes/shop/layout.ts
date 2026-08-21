import { Div, type Child, type Mountable } from "@implementjs/core";

export default function Layout({ children }: { children: Mountable }): Child {
	return Div({ class: "shop" }, children);
}
