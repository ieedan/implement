import type { Child } from "@implementjs/core";
import { CollectionIndexPage } from "@/lib/collection-page";
import { createPages } from "@/lib/content";

export default function Page(): Child {
	return CollectionIndexPage(createPages, "Create");
}
