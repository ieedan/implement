import { defineDynamicEnv } from "@implementjs/kit/env";
import * as v from "valibot";

export const env = defineDynamicEnv({
	ROTATING_TOKEN: v.string(),
	SESSION_TTL: v.pipe(v.string(), v.transform(Number), v.number()),
});
