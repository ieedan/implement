import { tutorials } from "@/lib/tutorials";
import { pageOgImageResponse } from "@/lib/og-image.server";
import type { RequestEvent } from "./$types";

export async function GET({ params }: RequestEvent): Promise<Response> {
	return await pageOgImageResponse(tutorials, "Tutorial", params.slug);
}
