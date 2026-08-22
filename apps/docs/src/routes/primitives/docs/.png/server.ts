import { primitivePages } from "@/lib/content";
import { pageOgImageResponse } from "@/lib/og-image.server";

export async function GET(): Promise<Response> {
	return await pageOgImageResponse(primitivePages, "Primitives", "");
}
