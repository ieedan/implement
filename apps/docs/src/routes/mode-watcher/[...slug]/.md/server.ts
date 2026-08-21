import { modeWatcherPages } from "@/lib/content";
import { markdownResponse } from "@/lib/markdown";
import type { RequestEvent } from "./$types";

export function GET({ params }: RequestEvent): Response {
	return markdownResponse(modeWatcherPages, "mode-watcher", params.slug);
}
