import type { Child } from "@implementjs/core";
import { collectionIndex } from "@/lib/collection-page";
import { pages } from "@/lib/content";
import { DocsPage } from "@/lib/views/docs-page";

const index = collectionIndex(pages, "Docs");

export default function Page(): Child {
	return DocsPage(index, pages);
}
