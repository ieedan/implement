import type { LoadEvent } from "./$types";

export default function load({ locals }: LoadEvent) {
	return { user: locals.user };
}
