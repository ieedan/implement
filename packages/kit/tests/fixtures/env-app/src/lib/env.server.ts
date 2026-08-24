import { defineEnv } from "@implementjs/kit";
import * as v from "valibot";

export const env = defineEnv({
	DATABASE_URL: v.string(),
});
