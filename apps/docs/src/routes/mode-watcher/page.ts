import type { Child } from "@implementjs/core";
import { CollectionIndexPage } from "@/lib/collection-page";
import { modeWatcherPages } from "@/lib/content";

export default function Page(): Child {
	return CollectionIndexPage(modeWatcherPages, "Mode Watcher");
}
