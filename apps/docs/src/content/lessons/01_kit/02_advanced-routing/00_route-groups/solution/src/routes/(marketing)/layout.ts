import { A, Div, Main, Nav } from "@implementjs/core";

export default function Layout({ children }) {
	return Div(
		Nav(
			A({ href: "/" }, "home"),
			A({ href: "/about" }, "about"),
			A({ href: "/contact" }, "contact"),
		),
		Main(children),
	);
}
