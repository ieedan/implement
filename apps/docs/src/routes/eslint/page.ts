import type { Child } from "@implementjs/core";
import { CollectionIndexPage } from "@/lib/collection-page";
import { eslintPages } from "@/lib/content";

export default function Page(): Child {
	return CollectionIndexPage(eslintPages, "ESLint");
}
