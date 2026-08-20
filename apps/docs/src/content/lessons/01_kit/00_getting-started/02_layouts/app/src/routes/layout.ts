import { Div, Main } from "@implementjs/core";

export default function Layout({ children }) {
	return Div(Main(children));
}
