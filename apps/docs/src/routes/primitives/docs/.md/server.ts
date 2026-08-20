import { primitivePages } from "@/lib/content";
import { markdownResponse } from "@/lib/markdown";

export function GET(): Response {
	return markdownResponse(primitivePages, "primitives", "");
}
