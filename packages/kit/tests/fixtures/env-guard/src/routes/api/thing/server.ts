import { secret } from "@/lib/secrets.server";

/** The client wants this; the handler beside it must never ship. */
export const ThingSchema = { name: "thing" };

export function GET(): Response {
	return new Response(secret.token);
}
