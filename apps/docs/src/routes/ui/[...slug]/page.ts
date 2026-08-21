import type { Child } from "@implementjs/core";
import { CollectionPage } from "@/lib/collection-page";
import { uiPages } from "@/lib/content";
import type { PageProps } from "./$types";

export default function Page({ params }: PageProps): Child {
	return CollectionPage(params.slug, uiPages);
}
