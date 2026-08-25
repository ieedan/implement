import type { LayoutLoadEvent } from "./$types";

/** Reads the section's decision rather than making it a second time. */
export default async function load({ parent }: LayoutLoadEvent) {
	const { workspace } = await parent();
	return { section: `${workspace}/deep` };
}
