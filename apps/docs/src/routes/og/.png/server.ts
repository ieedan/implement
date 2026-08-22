import { ogImageResponse } from "@/lib/og-image.server";

/**
 * The card every page without a generated twin of its own points at — the home
 * page, the repl, the package index. An extension route with no page under it,
 * so it prerenders to exactly `/og.png` and nothing else claims that path.
 */
export async function GET(): Promise<Response> {
	return await ogImageResponse({
		title: "implement",
		description: "A simple ergonomic ui framework without a compiler.",
	});
}
