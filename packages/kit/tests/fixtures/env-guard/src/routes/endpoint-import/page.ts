import { P, type Child } from "@implementjs/core";
// a route's `server.ts` is server-only even though its name carries no `.server`
import { ThingSchema } from "../api/thing/server";

export default function Page(): Child {
	return P(ThingSchema.name);
}
