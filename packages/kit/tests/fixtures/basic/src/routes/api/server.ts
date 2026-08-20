export async function POST({ request }: { request: Request }): Promise<Response> {
	const body = (await request.json()) as { name: string };
	return Response.json({ hello: body.name });
}
