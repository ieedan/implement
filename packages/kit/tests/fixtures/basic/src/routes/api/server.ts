export async function POST({ request }: { request: Request }): Promise<Response> {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Test fixture validates request JSON shape inline.
	const body = (await request.json()) as { name: string };
	return Response.json({ hello: body.name });
}
