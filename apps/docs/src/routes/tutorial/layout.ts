import type { Child } from "@implementjs/core";
import { TutorialsLayout } from "@/components/tutorials/layout";
import type { LayoutProps } from "./$types";

export default function Layout({ children }: LayoutProps): Child {
	return TutorialsLayout(children);
}
