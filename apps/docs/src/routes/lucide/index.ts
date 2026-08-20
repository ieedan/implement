import type { Child } from "@implementjs/core";
import { collectionIndex } from "@/lib/collection-page";
import { lucidePages } from "@/lib/content";
import { DocsPage } from "@/lib/views/docs-page";

const index = collectionIndex(lucidePages, "Lucide");

export default function Page(): Child {
	return DocsPage(index, lucidePages);
}
