import type { RequestEvent } from "@implementjs/kit/server";

export function GET() {
	return Response.json({ ok: true });
}

export async function POST(event: RequestEvent) {
	const body: unknown = await event.request.json();
	return Response.json({ echoed: body, user: event.locals.user });
}
