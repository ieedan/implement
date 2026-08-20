export function GET({ params }: { params: { slug: string } }): Response {
	return new Response(`# ${params.slug}\n`, {
		headers: { "content-type": "text/markdown; charset=utf-8" },
	});
}
