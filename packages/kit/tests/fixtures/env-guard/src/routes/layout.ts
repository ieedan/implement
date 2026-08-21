import { Main, type Child, type Mountable } from "@implementjs/core";

export default function Layout({ children }: { children: Mountable }): Child {
	return Main(children);
}
