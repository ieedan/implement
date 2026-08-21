import { sequence, type Handle } from "@implementjs/kit/server";

/** Reads the caller out of a header and hands it to the routes through locals. */
const authenticate: Handle = async ({ event, resolve }) => {
	event.locals.user = event.request.headers.get("x-user");
	if (event.url.pathname === "/private" && event.locals.user === null) {
		return new Response("nope", { status: 401 });
	}
	return await resolve(event);
};

/** Marks up the response so tests can see the hook ran around the render. */
const stamp: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace("</head>", '<meta name="stamped" />\n\t</head>'),
	});
	response.headers.set("x-route-id", event.route.id ?? "none");
	response.headers.set("x-data-request", String(event.isDataRequest));
	return response;
};

export const handle = sequence(authenticate, stamp);
