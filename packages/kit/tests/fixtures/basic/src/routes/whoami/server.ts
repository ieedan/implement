import type { RequestEvent } from "./$types";

export function GET({ locals, route }: RequestEvent): Response {
	return Response.json({ user: locals.user, routeId: route.id });
}
