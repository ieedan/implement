import { router } from "$implement/router";
import { Div, Main, Nav } from "@implementjs/core";
import type { LayoutProps } from "./$types";
import "../app.css";

export default function Layout({ children }: LayoutProps) {
	return Div(
		Nav(
			{ class: "flex items-center justify-center gap-4 border-b border-zinc-800 p-4 text-sm" },
			router.Link({ class: "text-zinc-400 hover:text-zinc-200", to: "/" }, "Home"),
			router.Link({ class: "text-zinc-400 hover:text-zinc-200", to: "/about" }, "About"),
		),
		Main({ class: "flex-1" }, children),
	);
}
