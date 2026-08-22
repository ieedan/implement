import { formishPages } from "@/lib/content";
import { pageOgImageResponse } from "@/lib/og-image.server";
import type { RequestEvent } from "./$types";

export async function GET({ params }: RequestEvent): Promise<Response> {
	return await pageOgImageResponse(formishPages, "Formish", params.slug);
}
