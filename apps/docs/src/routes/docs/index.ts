import type { Child } from "@implementjs/core";
import { CollectionIndexPage } from "@/lib/collection-page";
import { pages } from "@/lib/content";

export default function Page(): Child {
	return CollectionIndexPage(pages, "Docs");
}
