import { P, type Child } from "@implementjs/core";
import type { Secret } from "@/lib/secrets.server";

export default function Page(): Child {
	const secret: Secret = { token: "client-side" };
	return P(secret.token);
}
