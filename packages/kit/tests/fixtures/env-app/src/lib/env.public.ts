import { defineEnv } from "@implementjs/kit";
import * as v from "valibot";

export const env = defineEnv({
	PUBLIC_SITE_URL: v.pipe(v.string(), v.url()),
	PUBLIC_ANALYTICS_ID: v.string(),
});

/** A plain export, inlined alongside the env object. */
export const label = "public";
