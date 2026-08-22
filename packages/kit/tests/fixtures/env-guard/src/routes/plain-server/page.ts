import { P, type Child } from "@implementjs/core";
// only a route's `server.ts` is an endpoint — the name alone means nothing
import { label } from "@/lib/server";

export default function Page(): Child {
	return P(label);
}
