import { env } from "@/lib/env.dynamic.public";
import { P, type Child } from "@implementjs/core";

export default function Page(): Child {
	return P(`${env.PUBLIC_RUNTIME_API} limit ${env.PUBLIC_RUNTIME_LIMIT}`);
}
