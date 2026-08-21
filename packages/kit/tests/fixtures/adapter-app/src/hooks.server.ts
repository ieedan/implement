import type { Handle } from "@implementjs/kit/server";

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = event.request.headers.get("x-user");
	const response = await resolve(event);
	response.headers.set("x-route-id", event.route.id ?? "none");
	return response;
};
