import type { Child } from "@implementjs/core";
import { collectionIndex } from "@/lib/collection-page";
import { primitivePages } from "@/lib/content";
import { DocsPage } from "@/lib/views/docs-page";

const index = collectionIndex(primitivePages, "Primitives");

export default function Page(): Child {
	return DocsPage(index, primitivePages);
}
