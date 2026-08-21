import { P, type Child } from "@implementjs/core";
// deliberately illegal: a client page reaching for a server file
import { secret } from "@/lib/secrets.server";

export default function Page(): Child {
	return P(secret.token);
}
