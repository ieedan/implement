import { state } from "./state.ts";

export async function GET() {
	const before = state.evaluated;
	await import("./evaluated.ts");
	return Response.json({ before, after: state.evaluated });
}
