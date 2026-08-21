import type { Child } from "@implementjs/core";
import type { LayoutProps } from "./$types";
import "../app.css";

export default function Layout({ children }: LayoutProps): Child {
	return children;
}
