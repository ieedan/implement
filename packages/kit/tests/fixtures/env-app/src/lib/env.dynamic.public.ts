import { defineDynamicPublicEnv } from "@implementjs/kit/env";
import * as v from "valibot";

export const env = defineDynamicPublicEnv({
	PUBLIC_RUNTIME_API: v.pipe(v.string(), v.url()),
	PUBLIC_RUNTIME_LIMIT: v.pipe(v.string(), v.transform(Number), v.number()),
});
