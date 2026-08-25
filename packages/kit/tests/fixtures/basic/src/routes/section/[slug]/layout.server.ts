import type { LayoutLoadEvent } from "./$types";

/** What the section's shell shows — and what a 404 inside the section still needs. */
export default function load({ params }: LayoutLoadEvent) {
	return { workspace: params.slug };
}
