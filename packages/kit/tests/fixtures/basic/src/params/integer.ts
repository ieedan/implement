import { matcher, mismatch } from "@implementjs/kit/params";
import * as v from "valibot";

/** A parsing matcher: `[id=integer]` binds a `number`, not a `string`. */
export default matcher(
	(value) => {
		const parsed = Number(value);
		return /^\d+$/.test(value) ? parsed : mismatch;
	},
	// the parse says `number` in TypeScript; this says it where the OpenAPI
	// document is written, which is not TypeScript
	{ schema: v.pipe(v.number(), v.integer()) },
);
