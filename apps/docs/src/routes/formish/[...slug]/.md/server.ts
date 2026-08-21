import { formishPages } from "@/lib/content";
import { markdownResponse } from "@/lib/markdown";
import type { RequestEvent } from "./$types";

export function GET({ params }: RequestEvent): Response {
	return markdownResponse(formishPages, "formish", params.slug);
}
