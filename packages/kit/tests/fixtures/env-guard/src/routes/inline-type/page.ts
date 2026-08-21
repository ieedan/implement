import { P, type Child } from "@implementjs/core";
// the documented papercut: under `verbatimModuleSyntax` an inline `type` specifier leaves a
// bare side-effect import behind, so the guard sees it. Write `import type` instead.
import { type Secret } from "@/lib/secrets.server";

export default function Page(): Child {
	const secret: Secret = { token: "client-side" };
	return P(secret.token);
}
