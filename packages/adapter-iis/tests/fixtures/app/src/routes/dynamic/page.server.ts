import type { RequestEvent } from "@implementjs/kit/server";

export default function load(event: RequestEvent) {
	return { user: event.locals.user ?? "anonymous" };
}
