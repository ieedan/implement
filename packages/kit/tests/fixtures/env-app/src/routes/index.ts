import { P, type Child } from "@implementjs/core";
import { env } from "@/lib/env.public";

export default function Page(): Child {
	return P(env.PUBLIC_SITE_URL);
}
