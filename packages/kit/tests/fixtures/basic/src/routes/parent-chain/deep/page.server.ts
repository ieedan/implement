import type { LoadEvent } from "./$types";

/** Two layouts up: `parent()` is both of them, merged the way `data` is. */
export default async function load({ parent }: LoadEvent) {
	const { workspace, section } = await parent();
	return { title: `${section} in ${workspace}` };
}
