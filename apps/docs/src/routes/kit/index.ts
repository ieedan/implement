import type { Child } from "@implementjs/core";
import { collectionIndex } from "@/lib/collection-page";
import { kitPages } from "@/lib/content";
import { DocsPage } from "@/lib/views/docs-page";

const index = collectionIndex(kitPages, "Kit");

export default function Page(): Child {
	return DocsPage(index, kitPages);
}
