// Deliberately misnamed: kit routes `server.ts`, so this file is colocated code
// that serves nothing. The dev server warns about it — see plugin.test.ts.
export function GET(): Response {
	return new Response("never reached");
}
