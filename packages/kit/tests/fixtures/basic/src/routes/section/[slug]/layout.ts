import { Div, P, type Child } from "@implementjs/core";
import type { LayoutProps } from "./$types";

export default function Layout({ children, data }: LayoutProps): Child {
	return Div({ class: "workspace" }, P(data.bind("workspace")), children);
}
