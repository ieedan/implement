import type { Child } from "@implementjs/core";
import { DocsLayout } from "@/lib/components/docs/layout";
import { createPages } from "@/lib/content";
import type { LayoutProps } from "./$types";

export default function Layout({ children }: LayoutProps): Child {
	return DocsLayout(children, { pages: createPages, label: "Create" });
}
