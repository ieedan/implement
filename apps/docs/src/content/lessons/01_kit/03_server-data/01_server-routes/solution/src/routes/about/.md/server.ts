export function GET() {
	return new Response(
		"# About this site\n\nBuilt with implement kit.\n\nThis page also exists as plain markdown — you are reading it.\n",
		{ headers: { "content-type": "text/markdown; charset=utf-8" } },
	);
}
