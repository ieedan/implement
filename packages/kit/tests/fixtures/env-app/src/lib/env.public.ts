import { defineEnv } from "@implementjs/kit";
import { z } from "zod";

export const env = defineEnv({
	PUBLIC_SITE_URL: z.url(),
	PUBLIC_ANALYTICS_ID: z.string(),
});

/** A plain export, inlined alongside the env object. */
export const label = "public";
