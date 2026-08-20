export function GET() {
	// Return the markdown twin of the about page
	return new Response("TODO", {
		headers: { "content-type": "text/markdown; charset=utf-8" },
	});
}
