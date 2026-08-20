import { pages } from "@/lib/content";
import { markdownResponse } from "@/lib/markdown";

export function GET(): Response {
	return markdownResponse(pages, "", "");
}
